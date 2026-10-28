package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.DuesPayment;
import com.mostate.lacrosse.Model.OrderForm;
import com.mostate.lacrosse.Model.OrderFormItem;
import com.mostate.lacrosse.Model.OrderFormSubmission;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.DuesPaymentRepository;
import com.mostate.lacrosse.Repository.OrderFormItemRepository;
import com.mostate.lacrosse.Repository.OrderFormRepository;
import com.mostate.lacrosse.Repository.OrderFormSubmissionRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Service.SeasonService;
import com.mostate.lacrosse.Utils.EmailTemplate;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Admin-built order forms (e.g. gear orders). Items are priced by the admin; a player's
 * submission is priced server-side from those stored item prices (never trusted from the
 * client), and - since this is money - the total posts immediately as a CHARGE to the
 * player's dues balance, the same ledger every other charge goes through.
 */
@RestController
@RequestMapping("/api/order-forms")
public class OrderFormController {

    @org.springframework.beans.factory.annotation.Value("${app.frontend.base-url:https://missouristatelacrosse.com}")
    private String frontendBaseUrl = "https://missouristatelacrosse.com";

    private final OrderFormRepository formRepo;
    private final OrderFormItemRepository itemRepo;
    private final OrderFormSubmissionRepository submissionRepo;
    private final PlayerRepository playerRepo;
    private final DuesPaymentRepository duesRepo;
    private final AuthorizationService authorizationService;
    private final PlayerProfileService profileService;
    private final S3Service s3Service;
    private final EmailService emailService;
    private final SeasonService seasonService;

    public OrderFormController(
        OrderFormRepository formRepo,
        OrderFormItemRepository itemRepo,
        OrderFormSubmissionRepository submissionRepo,
        PlayerRepository playerRepo,
        DuesPaymentRepository duesRepo,
        AuthorizationService authorizationService,
        PlayerProfileService profileService,
        S3Service s3Service,
        EmailService emailService,
        SeasonService seasonService
    ) {
        this.formRepo = formRepo;
        this.itemRepo = itemRepo;
        this.submissionRepo = submissionRepo;
        this.playerRepo = playerRepo;
        this.duesRepo = duesRepo;
        this.authorizationService = authorizationService;
        this.profileService = profileService;
        this.s3Service = s3Service;
        this.emailService = emailService;
        this.seasonService = seasonService;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    // Managing forms/items doesn't expose balances or move money by itself (submit() is
    // the money-moving endpoint, gated separately below), so board members and up can run
    // it, same precedent as TodoController and EventsController's board-gated endpoints.
    private boolean isBoard(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isBoardOrAbove(uid, program, token);
    }

    private boolean isSelfOrAdmin(HttpServletRequest request, Player player, String program) {
        if (isAdmin(request, program)) return true;
        String uid = (String) request.getAttribute("firebaseUid");
        if (uid == null) return false;
        return profileService.isSelf(player, uid) || profileService.isLinkedParent(player, uid);
    }

    // --- Admin: manage forms ------------------------------------------------------------

    @GetMapping
    public ResponseEntity<?> listAll(HttpServletRequest request, @RequestParam(defaultValue = "men") String program) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        return ResponseEntity.ok(formRepo.findAll().stream().map(this::toFormResponse).toList());
    }

    /** Player portal: active forms only, with items, no admin gate needed to view. */
    @GetMapping("/active")
    public ResponseEntity<?> listActive() {
        return ResponseEntity.ok(formRepo.findAllByActiveTrueOrderByCreatedAtDesc().stream().map(this::toFormResponse).toList());
    }

    @PostMapping
    public ResponseEntity<?> createForm(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody FormRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        if (body.title() == null || body.title().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Title is required"));
        }
        OrderForm form = new OrderForm();
        form.setTitle(TextSanitizer.clean(body.title()));
        form.setDescription(TextSanitizer.clean(body.description()));
        form.setActive(body.active() == null || body.active());
        OrderForm saved = formRepo.save(form);

        if (Boolean.TRUE.equals(body.notifyPlayers())) {
            List<Player> players = playerRepo.findAllBySeason(seasonService.getActiveCode());
            notifyPlayers(saved, players, false, program);
        }

        return ResponseEntity.ok(toFormResponse(saved));
    }

    /**
     * Emails current-season players about an order form - either everyone (new form,
     * isReminder=false) or just whoever hasn't submitted yet (isReminder=true). Silently
     * skips players with no email on file rather than failing the whole batch over one.
     */
    private int notifyPlayers(OrderForm form, List<Player> players, boolean isReminder, String program) {
        String portalPath = "women".equalsIgnoreCase(program) ? "/women/portal" : "/portal";
        String formLink = frontendBaseUrl.replaceAll("/+$", "") + portalPath + "?form=" + form.getId();
        String subject = isReminder ? "Reminder: " + form.getTitle() : "New Order Form: " + form.getTitle();
        String body = EmailTemplate.paragraph(isReminder
            ? "This is a reminder that you still need to submit an order for:"
            : "A new order form is open:")
            + EmailTemplate.paragraph("<strong>" + form.getTitle() + "</strong>")
            + (form.getDescription() != null && !form.getDescription().isBlank()
                ? EmailTemplate.paragraph(form.getDescription())
                : "")
            + EmailTemplate.paragraph("Place your order in your player portal:")
            + EmailTemplate.button(formLink, "Open Order Form");
        String html = EmailTemplate.wrap(null, body);

        int sent = 0;
        for (Player p : players) {
            if (p.getEmail() == null || p.getEmail().isBlank()) continue;
            if (emailService.sendEmail(p.getEmail(), subject, html)) sent++;
        }
        return sent;
    }

    /** Emails only the current-season players who haven't submitted an order for this form yet. */
    @PostMapping("/{id}/remind")
    public ResponseEntity<?> remind(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        OrderForm form = formRepo.findById(id).orElse(null);
        if (form == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Order form not found"));
        }
        int sent = notifyPlayers(form, playersNotSubmitted(id), true, program);
        return ResponseEntity.ok(Map.of("remindedCount", sent));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateForm(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody FormRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        OrderForm form = formRepo.findById(id).orElse(null);
        if (form == null) return ResponseEntity.notFound().build();
        if (body.title() != null) form.setTitle(TextSanitizer.clean(body.title()));
        if (body.description() != null) form.setDescription(TextSanitizer.clean(body.description()));
        if (body.active() != null) form.setActive(body.active());
        return ResponseEntity.ok(toFormResponse(formRepo.save(form)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteForm(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        itemRepo.deleteAll(itemRepo.findAllByFormIdOrderBySortOrderAsc(id));
        formRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // --- Admin: manage items -------------------------------------------------------------

    @PostMapping("/{formId}/items")
    public ResponseEntity<?> addItem(
        HttpServletRequest request,
        @PathVariable UUID formId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody ItemRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        if (body.name() == null || body.name().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Item name is required"));
        }
        OrderFormItem item = new OrderFormItem();
        item.setFormId(formId);
        item.setName(TextSanitizer.clean(body.name()));
        item.setDescription(cleanDescription(body.description()));
        item.setFirstYearComp(Boolean.TRUE.equals(body.firstYearComp()));
        // Omitted means "work it out from the name"; an empty string means no size category.
        item.setSizeCategory(body.sizeCategory() == null
            ? inferSizeCategory(body.name(), body.options())
            : normalizeSizeCategory(body.sizeCategory()));
        item.setPrice(body.price());
        if (body.image() != null) {
            item.setImage(body.image().isBlank() ? null : s3Service.extractKey(body.image()));
        }
        item.setOptions(JsonUtils.toJson(body.options() != null ? body.options() : List.of()));
        return ResponseEntity.ok(toItemResponse(itemRepo.save(item)));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<?> updateItem(
        HttpServletRequest request,
        @PathVariable UUID itemId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody ItemRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        OrderFormItem item = itemRepo.findById(itemId).orElse(null);
        if (item == null) return ResponseEntity.notFound().build();
        if (body.name() != null) item.setName(TextSanitizer.clean(body.name()));
        if (body.description() != null) item.setDescription(cleanDescription(body.description()));
        if (body.firstYearComp() != null) item.setFirstYearComp(body.firstYearComp());
        if (body.sizeCategory() != null) item.setSizeCategory(normalizeSizeCategory(body.sizeCategory()));
        if (body.price() != null) item.setPrice(body.price());
        if (body.image() != null) {
            item.setImage(body.image().isBlank() ? null : s3Service.extractKey(body.image()));
        }
        if (body.options() != null) item.setOptions(JsonUtils.toJson(body.options()));
        return ResponseEntity.ok(toItemResponse(itemRepo.save(item)));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<?> deleteItem(
        HttpServletRequest request,
        @PathVariable UUID itemId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        itemRepo.deleteById(itemId);
        return ResponseEntity.noContent().build();
    }

    // --- Player: submit an order ----------------------------------------------------------

    @PostMapping("/{formId}/submit")
    @Transactional
    public ResponseEntity<?> submit(
        HttpServletRequest request,
        @PathVariable UUID formId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody SubmitRequest body
    ) {
        OrderForm form = formRepo.findById(formId).orElse(null);
        if (form == null || !form.isActive()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("This order form is not available"));
        }
        Player player = playerRepo.findById(body.playerId()).orElse(null);
        if (player == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
        }
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        if (body.selections() == null || body.selections().isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("At least one item is required"));
        }

        List<OrderFormItem> items = itemRepo.findAllByFormIdOrderBySortOrderAsc(formId);
        Map<UUID, OrderFormItem> itemsById = items.stream()
            .collect(java.util.stream.Collectors.toMap(OrderFormItem::getId, i -> i));

        boolean firstYear = isFirstYear(player);
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal compedTotal = BigDecimal.ZERO;
        List<Map<String, Object>> priced = new ArrayList<>();
        for (Selection sel : body.selections()) {
            OrderFormItem item = itemsById.get(sel.itemId());
            if (item == null || !formId.equals(item.getFormId())) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Invalid item in selection"));
            }
            int qty = sel.quantity() != null && sel.quantity() > 0 ? sel.quantity() : 1;
            BigDecimal unitPrice = item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO;
            String option = sel.option() != null ? sel.option() : "";
            // First Year Comp covers one unit; anything beyond that is charged on its own line.
            int compedQty = firstYear && item.isFirstYearComp() && unitPrice.signum() > 0 ? 1 : 0;
            if (compedQty > 0) {
                Map<String, Object> comped = pricedLine(item, option, compedQty, unitPrice);
                comped.put("waived", true);
                comped.put("waivedReason", "First Year Comp");
                priced.add(comped);
                total = total.add(unitPrice);
                compedTotal = compedTotal.add(unitPrice);
            }
            int chargedQty = qty - compedQty;
            if (chargedQty > 0) {
                Map<String, Object> line = pricedLine(item, option, chargedQty, unitPrice);
                priced.add(line);
                total = total.add((BigDecimal) line.get("lineTotal"));
            }
        }

        OrderFormSubmission submission = new OrderFormSubmission();
        submission.setFormId(formId);
        submission.setPlayerId(player.getId());
        submission.setSelections(JsonUtils.toJson(priced));
        submission.setTotal(total);
        submission.setSubmittedByUid((String) request.getAttribute("firebaseUid"));
        submissionRepo.save(submission);

        rememberSizes(player, body.selections(), itemsById);

        BigDecimal owed = total.subtract(compedTotal);
        if (owed.signum() > 0) {
            DuesPayment charge = new DuesPayment();
            charge.setPlayerId(player.getId());
            charge.setAmount(owed);
            charge.setType("CHARGE");
            charge.setNote("Order: " + form.getTitle()
                + (compedTotal.signum() > 0 ? " ($" + compedTotal.setScale(2) + " First Year Comp not charged)" : ""));
            charge.setPaidByUid((String) request.getAttribute("firebaseUid"));
            duesRepo.save(charge);

            BigDecimal current = player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO;
            player.setBalance(current.add(owed));
            playerRepo.save(player);
        }

        return ResponseEntity.ok(Map.of(
            "submissionId", submission.getId(),
            "total", owed,
            "firstYearComp", compedTotal,
            "newBalance", player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO
        ));
    }

    @GetMapping("/{formId}/submissions")
    public ResponseEntity<?> submissions(
        HttpServletRequest request,
        @PathVariable UUID formId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        List<Map<String, Object>> results = submissionRepo.findAllByFormIdOrderByCreatedAtDesc(formId).stream()
            .map(this::toSubmissionResponse)
            .toList();
        return ResponseEntity.ok(results);
    }

    private Map<String, Object> toSubmissionResponse(OrderFormSubmission s) {
        Player player = playerRepo.findById(s.getPlayerId()).orElse(null);
        List<Object> lines = JsonUtils.readList(s.getSelections());
        BigDecimal waivedTotal = BigDecimal.ZERO;
        for (Object o : lines) {
            if (o instanceof Map<?, ?> m && Boolean.TRUE.equals(m.get("waived"))) {
                waivedTotal = waivedTotal.add(new BigDecimal(String.valueOf(m.get("lineTotal") == null ? "0" : m.get("lineTotal"))));
            }
        }
        BigDecimal total = s.getTotal() != null ? s.getTotal() : BigDecimal.ZERO;
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("playerName", player != null ? player.getName() : "Unknown player");
        m.put("selections", lines);
        m.put("total", total);
        m.put("waivedTotal", waivedTotal);
        m.put("owed", total.subtract(waivedTotal));
        m.put("createdAt", s.getCreatedAt());
        return m;
    }

    /**
     * Waives (or un-waives) one line of a player's order, e.g. gear that's included in a
     * player's first year. Waiving takes that line's price back off the player's balance as a
     * WAIVED ledger entry; the budget only counts CREDIT entries as income, so a waiver never
     * shows up as money received. Un-waiving charges it again.
     */
    @PutMapping("/submissions/{submissionId}/lines/{index}/waived")
    public ResponseEntity<?> setLineWaived(
        HttpServletRequest request,
        @PathVariable UUID submissionId,
        @PathVariable int index,
        @RequestParam(defaultValue = "men") String program,
        @RequestParam boolean value
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        OrderFormSubmission submission = submissionRepo.findById(submissionId).orElse(null);
        if (submission == null) return ResponseEntity.notFound().build();
        List<Map<String, Object>> lines = new java.util.ArrayList<>();
        for (Object o : JsonUtils.readList(submission.getSelections())) {
            if (o instanceof Map<?, ?> m) {
                Map<String, Object> copy = new java.util.LinkedHashMap<>();
                m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                lines.add(copy);
            }
        }
        if (index < 0 || index >= lines.size()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("No such line on this order"));
        }
        Map<String, Object> line = lines.get(index);
        boolean wasWaived = Boolean.TRUE.equals(line.get("waived"));
        if (wasWaived == value) {
            return ResponseEntity.ok(toSubmissionResponse(submission));
        }

        BigDecimal lineTotal = new BigDecimal(String.valueOf(line.getOrDefault("lineTotal", "0")));
        Player player = playerRepo.findById(submission.getPlayerId()).orElse(null);
        if (player != null && lineTotal.signum() > 0) {
            OrderForm form = formRepo.findById(submission.getFormId()).orElse(null);
            String option = String.valueOf(line.getOrDefault("option", ""));
            String what = line.get("quantity") + " x " + line.get("name")
                + (option.isBlank() ? "" : " (" + option + ")")
                + (form != null ? ", " + form.getTitle() : "");
            DuesPayment entry = new DuesPayment();
            entry.setPlayerId(player.getId());
            entry.setAmount(lineTotal);
            entry.setType(value ? "WAIVED" : "CHARGE");
            entry.setNote((value ? "Waived: " : "Waiver removed: ") + what);
            entry.setPaidByUid((String) request.getAttribute("firebaseUid"));
            duesRepo.save(entry);

            BigDecimal current = player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO;
            player.setBalance(value ? current.subtract(lineTotal) : current.add(lineTotal));
            playerRepo.save(player);
        }

        line.put("waived", value);
        submission.setSelections(JsonUtils.toJson(lines));
        submissionRepo.save(submission);
        return ResponseEntity.ok(toSubmissionResponse(submission));
    }

    /**
     * Whether this player row is their first season: no row for the same player profile in
     * any earlier season. A row with no profile can't be checked, so it's never auto-comped
     * (the board can still waive by hand).
     */
    private boolean isFirstYear(Player player) {
        if (player.getProfileId() == null || player.getSeason() == null) return false;
        return playerRepo.findAllByProfileId(player.getProfileId()).stream()
            .map(Player::getSeason)
            .filter(java.util.Objects::nonNull)
            .noneMatch(season -> season.compareTo(player.getSeason()) < 0);
    }

    private static Map<String, Object> pricedLine(OrderFormItem item, String option, int qty, BigDecimal unitPrice) {
        Map<String, Object> line = new java.util.LinkedHashMap<>();
        line.put("itemId", item.getId().toString());
        line.put("name", item.getName());
        line.put("option", option);
        line.put("quantity", qty);
        line.put("unitPrice", unitPrice);
        line.put("lineTotal", unitPrice.multiply(BigDecimal.valueOf(qty)));
        return line;
    }

    /** Saves the size picked for each sized item on this order as the player's size for that category. */
    private void rememberSizes(Player player, List<Selection> selections, Map<UUID, OrderFormItem> itemsById) {
        if (player.getProfileId() == null) return;
        Map<String, Object> sizes = new java.util.LinkedHashMap<>(JsonUtils.readMap(profileService.getSizes(player.getProfileId())));
        boolean changed = false;
        for (Selection sel : selections) {
            OrderFormItem item = itemsById.get(sel.itemId());
            if (item == null || item.getSizeCategory() == null || sel.option() == null || sel.option().isBlank()) continue;
            if (!sel.option().equals(sizes.get(item.getSizeCategory()))) {
                sizes.put(item.getSizeCategory(), sel.option());
                changed = true;
            }
        }
        if (changed) profileService.setSizes(player.getProfileId(), JsonUtils.toJson(sizes));
    }

    /** A player's saved sizes, for pre-filling order forms and the portal's My Sizes card. */
    @GetMapping("/sizes")
    public ResponseEntity<?> getSizes(
        HttpServletRequest request,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) return ResponseEntity.notFound().build();
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        if (player.getProfileId() == null) return ResponseEntity.ok(Map.of());
        return ResponseEntity.ok(JsonUtils.readMap(profileService.getSizes(player.getProfileId())));
    }

    @PutMapping("/sizes")
    public ResponseEntity<?> setSizes(
        HttpServletRequest request,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody Map<String, String> body
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) return ResponseEntity.notFound().build();
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        if (player.getProfileId() == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("This player has no profile to save sizes on"));
        }
        Map<String, Object> sizes = new java.util.LinkedHashMap<>();
        body.forEach((category, size) -> {
            String c = normalizeSizeCategory(category);
            String v = size == null ? "" : TextSanitizer.clean(size).trim();
            if (c != null && !v.isEmpty() && v.length() <= 20) sizes.put(c, v);
        });
        profileService.setSizes(player.getProfileId(), JsonUtils.toJson(sizes));
        return ResponseEntity.ok(sizes);
    }

    /** Board view: every current-season player's saved sizes, for placing a team order. */
    @GetMapping("/sizes/roster")
    public ResponseEntity<?> rosterSizes(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        List<Map<String, Object>> rows = playerRepo.findAllBySeason(seasonService.getActiveCode()).stream()
            .sorted(java.util.Comparator.comparing(p -> p.getName() == null ? "" : p.getName()))
            .map(p -> {
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("playerId", p.getId());
                m.put("name", p.getName() != null ? p.getName() : "Unnamed player");
                m.put("position", p.getPosition());
                m.put("sizes", p.getProfileId() != null ? JsonUtils.readMap(profileService.getSizes(p.getProfileId())) : Map.of());
                return m;
            })
            .toList();
        return ResponseEntity.ok(rows);
    }

    /** Lets the portal show a first-year player that First Year Comp items are free for them. */
    @GetMapping("/first-year")
    public ResponseEntity<?> firstYear(
        HttpServletRequest request,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) return ResponseEntity.notFound().build();
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        return ResponseEntity.ok(Map.of("firstYear", isFirstYear(player)));
    }

    /** Current-season players with no submission for this form: the same list Remind emails. */
    @GetMapping("/{formId}/not-submitted")
    public ResponseEntity<?> notSubmitted(
        HttpServletRequest request,
        @PathVariable UUID formId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        List<Map<String, Object>> results = playersNotSubmitted(formId).stream()
            .sorted(java.util.Comparator.comparing(p -> p.getName() == null ? "" : p.getName()))
            .map(p -> {
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("playerId", p.getId());
                m.put("name", p.getName() != null ? p.getName() : "Unnamed player");
                m.put("hasEmail", p.getEmail() != null && !p.getEmail().isBlank());
                return m;
            })
            .toList();
        return ResponseEntity.ok(results);
    }

    private List<Player> playersNotSubmitted(UUID formId) {
        var submittedByPlayer = submissionRepo.findAllByFormIdOrderByCreatedAtDesc(formId).stream()
            .map(OrderFormSubmission::getPlayerId)
            .collect(java.util.stream.Collectors.toSet());
        return playerRepo.findAllBySeason(seasonService.getActiveCode()).stream()
            .filter(p -> !submittedByPlayer.contains(p.getId()))
            .toList();
    }

    // --- response shaping ------------------------------------------------------------------

    private Map<String, Object> toFormResponse(OrderForm form) {
        List<Map<String, Object>> items = itemRepo.findAllByFormIdOrderBySortOrderAsc(form.getId()).stream()
            .map(this::toItemResponse)
            .toList();
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", form.getId());
        m.put("title", form.getTitle());
        m.put("description", form.getDescription());
        m.put("active", form.isActive());
        m.put("items", items);
        m.put("createdAt", form.getCreatedAt());
        return m;
    }

    private Map<String, Object> toItemResponse(OrderFormItem item) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", item.getId());
        m.put("formId", item.getFormId());
        m.put("name", item.getName());
        m.put("description", item.getDescription());
        m.put("firstYearComp", item.isFirstYearComp());
        m.put("sizeCategory", item.getSizeCategory());
        m.put("price", item.getPrice());
        m.put("image", s3Service.toPresignedUrl(item.getImage(), Duration.ofHours(2)));
        m.put("options", JsonUtils.readList(item.getOptions()));
        return m;
    }

    public record FormRequest(String title, String description, Boolean active, Boolean notifyPlayers) {}

    public record ItemRequest(
        String name, String description, Boolean firstYearComp, String sizeCategory,
        BigDecimal price, String image, List<String> options
    ) {}

    /** Kinds of sized items a player's saved sizes are kept for. Mirrors src/Global/Common/utils/sizeCategories.ts. */
    private static final List<String> SIZE_CATEGORIES = List.of("shirt", "shorts", "hoodie", "pants", "polo", "jersey", "gloves");

    private static String normalizeSizeCategory(String raw) {
        String c = raw == null ? "" : raw.trim().toLowerCase();
        return SIZE_CATEGORIES.contains(c) ? c : null;
    }

    /** Same name rules as the V51 migration that categorized the existing items. */
    static String inferSizeCategory(String name, List<String> options) {
        if (name == null || options == null || options.isEmpty()) return null;
        String n = name.toLowerCase();
        if (n.contains("glove")) return "gloves";
        if (n.contains("hoodie") || n.contains("sweatshirt")) return "hoodie";
        if (n.contains("pant") || n.contains("jogger")) return "pants";
        if (n.contains("short")) return "shorts";
        if (n.contains("polo")) return "polo";
        if (n.contains("jersey")) return "jersey";
        if (n.contains("shirt") || n.contains("tee")) return "shirt";
        return null;
    }

    private static String cleanDescription(String raw) {
        if (raw == null) return null;
        String cleaned = TextSanitizer.clean(raw).trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    public record Selection(UUID itemId, String option, Integer quantity) {}

    public record SubmitRequest(UUID playerId, List<Selection> selections) {}
}
