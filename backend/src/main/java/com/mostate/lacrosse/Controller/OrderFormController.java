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
            notifyPlayers(saved, players, false);
        }

        return ResponseEntity.ok(toFormResponse(saved));
    }

    /**
     * Emails current-season players about an order form - either everyone (new form,
     * isReminder=false) or just whoever hasn't submitted yet (isReminder=true). Silently
     * skips players with no email on file rather than failing the whole batch over one.
     */
    private int notifyPlayers(OrderForm form, List<Player> players, boolean isReminder) {
        String subject = isReminder ? "Reminder: " + form.getTitle() : "New Order Form: " + form.getTitle();
        String body = EmailTemplate.paragraph(isReminder
            ? "This is a reminder that you still need to submit an order for:"
            : "A new order form is open:")
            + EmailTemplate.paragraph("<strong>" + form.getTitle() + "</strong>")
            + (form.getDescription() != null && !form.getDescription().isBlank()
                ? EmailTemplate.paragraph(form.getDescription())
                : "")
            + EmailTemplate.paragraph("Log in to your player portal to place your order.");
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
        List<Player> seasonPlayers = playerRepo.findAllBySeason(seasonService.getActiveCode());
        var submittedByPlayer = submissionRepo.findAllByFormIdOrderByCreatedAtDesc(id).stream()
            .map(OrderFormSubmission::getPlayerId)
            .collect(java.util.stream.Collectors.toSet());
        List<Player> notSubmitted = seasonPlayers.stream()
            .filter(p -> !submittedByPlayer.contains(p.getId()))
            .toList();

        int sent = notifyPlayers(form, notSubmitted, true);
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

        BigDecimal total = BigDecimal.ZERO;
        List<Map<String, Object>> priced = new ArrayList<>();
        for (Selection sel : body.selections()) {
            OrderFormItem item = itemsById.get(sel.itemId());
            if (item == null || !formId.equals(item.getFormId())) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Invalid item in selection"));
            }
            int qty = sel.quantity() != null && sel.quantity() > 0 ? sel.quantity() : 1;
            BigDecimal unitPrice = item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO;
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(qty));
            total = total.add(lineTotal);
            priced.add(Map.of(
                "itemId", item.getId().toString(),
                "name", item.getName(),
                "option", sel.option() != null ? sel.option() : "",
                "quantity", qty,
                "unitPrice", unitPrice,
                "lineTotal", lineTotal
            ));
        }

        OrderFormSubmission submission = new OrderFormSubmission();
        submission.setFormId(formId);
        submission.setPlayerId(player.getId());
        submission.setSelections(JsonUtils.toJson(priced));
        submission.setTotal(total);
        submission.setSubmittedByUid((String) request.getAttribute("firebaseUid"));
        submissionRepo.save(submission);

        if (total.signum() > 0) {
            DuesPayment charge = new DuesPayment();
            charge.setPlayerId(player.getId());
            charge.setAmount(total);
            charge.setType("CHARGE");
            charge.setNote("Order: " + form.getTitle());
            charge.setPaidByUid((String) request.getAttribute("firebaseUid"));
            duesRepo.save(charge);

            BigDecimal current = player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO;
            player.setBalance(current.add(total));
            playerRepo.save(player);
        }

        return ResponseEntity.ok(Map.of(
            "submissionId", submission.getId(),
            "total", total,
            "newBalance", player.getBalance()
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
            .map(s -> {
                Player player = playerRepo.findById(s.getPlayerId()).orElse(null);
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("id", s.getId());
                m.put("playerName", player != null ? player.getName() : "Unknown player");
                m.put("selections", JsonUtils.readList(s.getSelections()));
                m.put("total", s.getTotal());
                m.put("createdAt", s.getCreatedAt());
                return m;
            })
            .toList();
        return ResponseEntity.ok(results);
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
        m.put("price", item.getPrice());
        m.put("image", s3Service.toPresignedUrl(item.getImage(), Duration.ofHours(2)));
        m.put("options", JsonUtils.readList(item.getOptions()));
        return m;
    }

    public record FormRequest(String title, String description, Boolean active, Boolean notifyPlayers) {}

    public record ItemRequest(String name, BigDecimal price, String image, List<String> options) {}

    public record Selection(UUID itemId, String option, Integer quantity) {}

    public record SubmitRequest(UUID playerId, List<Selection> selections) {}
}
