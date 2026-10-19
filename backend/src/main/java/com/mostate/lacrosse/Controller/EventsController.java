package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Event;
import com.mostate.lacrosse.Model.EventPosItem;
import com.mostate.lacrosse.Model.EventRegistration;
import com.mostate.lacrosse.Model.EventTeam;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Model.RaffleEntry;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.EventPosItemRepository;
import com.mostate.lacrosse.Repository.EventRegistrationRepository;
import com.mostate.lacrosse.Repository.EventRepository;
import com.mostate.lacrosse.Repository.EventTeamRepository;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.RaffleEntryRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Service.StripeService;
import com.mostate.lacrosse.Service.TerminalPaymentRecorder;
import com.mostate.lacrosse.Utils.EmailTemplate;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.CustomerCollection;
import com.stripe.model.Invoice;
import com.stripe.model.InvoiceItem;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerListParams;
import com.stripe.param.InvoiceCreateParams;
import com.stripe.param.InvoiceItemCreateParams;
import com.stripe.param.InvoiceItemListParams;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/events")
public class EventsController {

    private final EventRepository eventRepo;
    private final EventRegistrationRepository registrationRepo;
    private final EventTeamRepository teamRepo;
    private final PaymentReceiptRepository receiptRepo;
    private final EventPosItemRepository posItemRepo;
    private final EmailService emailService;
    private final S3Service s3Service;
    private final AuthorizationService authorizationService;
    private final StripeService stripeService;
    private final RaffleEntryRepository raffleEntryRepo;
    private final UserAccountRepository userAccountRepo;
    private final PlayerRepository playerRepo;
    private final TerminalPaymentRecorder terminalPaymentRecorder;

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    public EventsController(
        EventRepository eventRepo,
        EventRegistrationRepository registrationRepo,
        EventTeamRepository teamRepo,
        PaymentReceiptRepository receiptRepo,
        EventPosItemRepository posItemRepo,
        EmailService emailService,
        S3Service s3Service,
        AuthorizationService authorizationService,
        StripeService stripeService,
        RaffleEntryRepository raffleEntryRepo,
        UserAccountRepository userAccountRepo,
        PlayerRepository playerRepo,
        TerminalPaymentRecorder terminalPaymentRecorder
    ) {
        this.eventRepo = eventRepo;
        this.registrationRepo = registrationRepo;
        this.teamRepo = teamRepo;
        this.receiptRepo = receiptRepo;
        this.posItemRepo = posItemRepo;
        this.emailService = emailService;
        this.s3Service = s3Service;
        this.authorizationService = authorizationService;
        this.stripeService = stripeService;
        this.raffleEntryRepo = raffleEntryRepo;
        this.userAccountRepo = userAccountRepo;
        this.playerRepo = playerRepo;
        this.terminalPaymentRecorder = terminalPaymentRecorder;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    // Event management (create/update/delete/registrations) doesn't expose balances or
    // other financial data, so board members and up can run it, not just admins.
    private boolean isBoard(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isBoardOrAbove(uid, program, token);
    }

    // Public: list published events
    @GetMapping
    public ResponseEntity<List<EventResponse>> listPublished() {
        return ResponseEntity.ok(
            eventRepo.findByPublishedTrueAndArchivedFalseOrderByStartTimeAsc().stream()
                .map(this::toResponse)
                .toList()
        );
    }

    // Public: get published event by slug
    @GetMapping("/slug/{slug}")
    public ResponseEntity<EventResponse> getBySlug(@PathVariable String slug) {
        return eventRepo.findBySlugAndPublishedTrueAndArchivedFalse(slug)
            .map(e -> ResponseEntity.ok(toResponse(e)))
            .orElse(ResponseEntity.notFound().build());
    }

    // Admin: list all events (including unpublished)
    @GetMapping("/admin")
    public ResponseEntity<?> listAll(HttpServletRequest request, @RequestParam(defaultValue = "men") String program) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        return ResponseEntity.ok(
            eventRepo.findAllByOrderByStartTimeAsc().stream()
                .map(this::toResponse)
                .toList()
        );
    }

    // Admin: create event
    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody EventPayload payload
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Event event = new Event();
        applyPayload(event, payload);
        return ResponseEntity.ok(toResponse(eventRepo.save(event)));
    }

    // Admin: update event
    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody EventPayload payload
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Event existing = eventRepo.findById(id).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();
        applyPayload(existing, payload);
        return ResponseEntity.ok(toResponse(eventRepo.save(existing)));
    }

    // Admin: delete event. Refused once any money is attached, because deleting takes the
    // registrations with it and leaves the budget ledger unable to name the event's payments.
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        if (hasMoneyRecords(id)) {
            return ResponseEntity.status(409).body(new ErrorResponse(
                "This event has payment records. Archive it instead so the budget keeps them."));
        }
        eventRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // Admin: archive or restore an event. Archived events are hidden from the public site and
    // the Tap to Pay app but keep every registration and payment for the budget.
    @PutMapping("/{id}/archived")
    public ResponseEntity<?> setArchived(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestParam boolean value
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        event.setArchived(value);
        return ResponseEntity.ok(toResponse(eventRepo.save(event)));
    }

    private boolean hasMoneyRecords(UUID eventId) {
        boolean receipts = receiptRepo.existsBySourceIn(List.of(
            "event-" + eventId, "event-registration-" + eventId, "event-pos-" + eventId));
        return receipts || registrationRepo.existsByEventIdAndAmountPaidGreaterThan(eventId, BigDecimal.ZERO);
    }

    // Admin: get all registrations for an event
    @GetMapping("/{id}/registrations")
    public ResponseEntity<?> registrations(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        List<EventRegistration> regs = registrationRepo.findAllByEventId(id);
        return ResponseEntity.ok(regs.stream().map(this::toRegResponse).toList());
    }

    // Public: check if a teammate slot exists for an email
    @GetMapping("/{id}/team-check")
    public ResponseEntity<TeamCheckResponse> teamCheck(
        @PathVariable UUID id,
        @RequestParam String email
    ) {
        String normalized = email.trim().toLowerCase();

        // Check if this email was listed as a teammate by someone already registered
        var byTeammate = registrationRepo.findByTeammateEmailAndEventIdAndPaidTrue(normalized, id);
        if (byTeammate.isPresent()) {
            EventRegistration r = byTeammate.get();
            return ResponseEntity.ok(new TeamCheckResponse(true, r.getTeamId(), r.getPayerName(), r.getPayerEmail()));
        }

        // Fallback: check if this email belongs to a payer who has a team (covers 2-person team joining)
        var byPayer = registrationRepo.findByPayerEmailAndEventIdAndPaidTrue(normalized, id);
        if (byPayer.isPresent() && byPayer.get().getTeamId() != null) {
            EventRegistration r = byPayer.get();
            return ResponseEntity.ok(new TeamCheckResponse(true, r.getTeamId(), r.getPayerName(), r.getPayerEmail()));
        }

        return ResponseEntity.ok(new TeamCheckResponse(false, null, null, null));
    }

    /**
     * Public, for the self-serve QR check-in page: fuzzy-suggests this event's unpaid
     * registrants as someone types their name, so they can find their own existing
     * registration and pay instead of accidentally creating a duplicate one. Only returns
     * name + amount owed - never email, since this is reachable by anyone who scans the
     * event's QR code.
     */
    @GetMapping("/{id}/registrant-search")
    public ResponseEntity<?> registrantSearch(
        @PathVariable UUID id,
        @RequestParam String q
    ) {
        String query = normalizeForSearch(q);
        if (query.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        BigDecimal price = event.getPrice() != null ? event.getPrice() : BigDecimal.ZERO;

        List<Map<String, Object>> matches = registrationRepo.findAllByEventId(id).stream()
            .filter(r -> !r.isPaid() && r.getPayerName() != null)
            .filter(r -> isLikelyNameMatch(query, normalizeForSearch(r.getPayerName())))
            .sorted(Comparator.comparingInt(r -> levenshtein(query, normalizeForSearch(r.getPayerName()))))
            .limit(5)
            .map(r -> {
                BigDecimal alreadyPaid = r.getAmountPaid() != null ? r.getAmountPaid() : BigDecimal.ZERO;
                BigDecimal due = price.subtract(alreadyPaid);
                return Map.<String, Object>of(
                    "registrationId", r.getId().toString(),
                    "payerName", r.getPayerName(),
                    "amountDue", due
                );
            })
            .toList();
        return ResponseEntity.ok(matches);
    }

    /**
     * Public, for the self-serve QR check-in page: pays off an existing unpaid
     * registration found via registrantSearch() above. Same payment validation as a brand
     * new registration going through register() below - real, completed, unused, matching
     * the event's price - just applied to a registration that already exists instead of
     * creating a new one.
     */
    @PostMapping("/{id}/registrations/{regId}/pay")
    public ResponseEntity<?> payExistingRegistration(
        @PathVariable UUID id,
        @PathVariable UUID regId,
        @RequestBody PayExistingRequest body
    ) {
        EventRegistration reg = registrationRepo.findById(regId).orElse(null);
        if (reg == null || !id.equals(reg.getEventId())) {
            return ResponseEntity.notFound().build();
        }
        if (reg.isPaid()) {
            return ResponseEntity.status(409).body(new ErrorResponse("This registration is already paid."));
        }
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        if (body.paypalOrderId() == null || body.paypalOrderId().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("paypalOrderId is required"));
        }
        if (registrationRepo.existsByPaypalOrderId(body.paypalOrderId())) {
            return ResponseEntity.status(409).body(new ErrorResponse("This payment has already been used for a registration."));
        }
        PaymentReceipt receipt = receiptRepo.findByOrderId(body.paypalOrderId()).orElse(null);
        if (receipt == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Payment not found"));
        }
        if (!"COMPLETED".equalsIgnoreCase(receipt.getStatus())) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Payment was not completed"));
        }
        BigDecimal price = event.getPrice() != null ? event.getPrice() : BigDecimal.ZERO;
        if (receipt.getAmount() == null || receipt.getAmount().compareTo(price) != 0) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Payment amount does not match this event's price"));
        }

        reg.setPaypalOrderId(body.paypalOrderId());
        reg.setAmountPaid(price);
        reg.setPaid(true);
        reg.setPaidAt(Instant.now());
        registrationRepo.save(reg);

        return ResponseEntity.ok(toRegResponse(reg));
    }

    /**
     * Scans this event's "team name"-labeled field (same one the team-pairing feature
     * uses) for people named as teammates who never submitted their own registration -
     * e.g. someone wrote "Jeff Cole, Seth Heartman" as teammates but only they themselves
     * registered. Only returns names that don't already match an existing registrant for
     * this event, and cross-references the rest of the database (other events, raffles,
     * the roster, and site accounts) for a known email/phone, so the admin can see at a
     * glance who's reachable by email vs who can only be caught in person. Nothing is
     * created here - see createUnmatchedTeammates() below for that, after admin review.
     */
    @GetMapping("/{id}/unmatched-teammates")
    public ResponseEntity<?> unmatchedTeammates(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        String teamFieldId = findTeamNameFieldId(event);
        if (teamFieldId == null) {
            return ResponseEntity.ok(List.of());
        }

        List<EventRegistration> regs = registrationRepo.findAllByEventId(id);
        Set<String> existingNormalizedNames = regs.stream()
            .map(EventRegistration::getPayerName)
            .filter(n -> n != null && !n.isBlank())
            .map(this::normalizeForSearch)
            .collect(Collectors.toSet());

        // normalized name -> {name, mentionedBy: [...]}
        Map<String, Map<String, Object>> candidates = new LinkedHashMap<>();
        for (EventRegistration reg : regs) {
            Map<String, Object> formData = JsonUtils.readMap(reg.getFormData());
            Object raw = formData.get(teamFieldId);
            if (raw == null) continue;
            for (String token : extractNameCandidates(raw.toString())) {
                String normalized = normalizeForSearch(token);
                if (normalized.length() < 2) continue;
                boolean alreadyRegistered = existingNormalizedNames.stream()
                    .anyMatch(n -> isLikelyNameMatch(normalized, n));
                if (alreadyRegistered) continue;

                Map<String, Object> candidate = candidates.get(normalized);
                if (candidate == null) {
                    candidate = new LinkedHashMap<>();
                    candidate.put("name", TextSanitizer.titleCaseName(token));
                    candidate.put("mentionedBy", new ArrayList<String>());
                    candidates.put(normalized, candidate);
                }
                @SuppressWarnings("unchecked")
                List<String> mentionedBy = (List<String>) candidate.get("mentionedBy");
                String by = reg.getPayerName();
                if (by != null && !mentionedBy.contains(by)) {
                    mentionedBy.add(by);
                }
            }
        }

        List<Map<String, Object>> result = candidates.values().stream().map(c -> {
            Map<String, Object> contact = findKnownContact((String) c.get("name"));
            Map<String, Object> out = new LinkedHashMap<>(c);
            if (contact != null) {
                out.putAll(contact);
            }
            return out;
        }).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * Creates an unpaid registration for each admin-approved name from the scan above, so
     * they immediately show up in the Tap to Pay app's existing unpaid-registrants list
     * and the QR check-in's search - no app changes needed, since those just read
     * whatever registrations already exist.
     */
    @PostMapping("/{id}/unmatched-teammates")
    public ResponseEntity<?> createUnmatchedTeammates(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody CreateUnmatchedRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        if (body.entries() == null || body.entries().isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("No names given"));
        }

        List<EventRegistration> created = new ArrayList<>();
        for (UnmatchedEntry entry : body.entries()) {
            if (entry.name() == null || entry.name().isBlank()) continue;
            EventRegistration reg = new EventRegistration();
            reg.setEventId(id);
            reg.setPayerName(TextSanitizer.titleCaseName(entry.name()));
            reg.setPayerEmail(entry.email() != null && !entry.email().isBlank() ? entry.email().trim().toLowerCase() : null);
            reg.setAmountPaid(BigDecimal.ZERO);
            reg.setPaid(false);
            reg.setFormData("{}");
            created.add(registrationRepo.save(reg));
        }
        return ResponseEntity.ok(created.stream().map(this::toRegResponse).toList());
    }

    /**
     * Re-runs the same cross-event/raffle/roster/account contact lookup used by the
     * unmatched-teammates scan, but against this event's OWN registrants who are still
     * missing an email - e.g. someone added as a phantom teammate before they'd shown up
     * anywhere else is now findable because they just registered for a different event
     * (the banquet, say) with their email on file. Only ever suggests; nothing is
     * overwritten until createBackfillEmails() below is called with admin-approved picks.
     */
    @GetMapping("/{id}/backfill-emails")
    public ResponseEntity<?> backfillEmailCandidates(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();

        List<Map<String, Object>> result = registrationRepo.findAllByEventId(id).stream()
            .filter(r -> r.getPayerName() != null && !r.getPayerName().isBlank())
            .filter(r -> r.getPayerEmail() == null || r.getPayerEmail().isBlank())
            .map(r -> {
                Map<String, Object> contact = findKnownContact(r.getPayerName());
                if (contact == null) return null;
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("registrationId", r.getId().toString());
                out.put("name", r.getPayerName());
                out.putAll(contact);
                return out;
            })
            .filter(Objects::nonNull)
            .toList();
        return ResponseEntity.ok(result);
    }

    /** Applies admin-approved email backfills. Skips a registration if it already has an email by now. */
    @PostMapping("/{id}/backfill-emails")
    public ResponseEntity<?> applyBackfillEmails(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody BackfillEmailsRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        if (body.updates() == null || body.updates().isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("No updates given"));
        }
        int applied = 0;
        for (BackfillEmailEntry entry : body.updates()) {
            if (entry.registrationId() == null || entry.email() == null || entry.email().isBlank()) continue;
            EventRegistration reg = registrationRepo.findById(entry.registrationId()).orElse(null);
            if (reg == null || !id.equals(reg.getEventId())) continue;
            if (reg.getPayerEmail() != null && !reg.getPayerEmail().isBlank()) continue;
            reg.setPayerEmail(entry.email().trim().toLowerCase());
            registrationRepo.save(reg);
            applied++;
        }
        return ResponseEntity.ok(Map.of("updated", applied));
    }

    public record BackfillEmailsRequest(List<BackfillEmailEntry> updates) {}
    public record BackfillEmailEntry(UUID registrationId, String email) {}

    /**
     * Extracts individual name candidates from a free-text teammates field. Parenthesized
     * content ("Nickname (Name1, Name2)") and the segment after the last "/" ("Nickname/
     * Name1, Name2") are treated as the authoritative name list when present, since a team
     * nickname otherwise pollutes the split. A comma-free, slash-free, paren-free string
     * ("Derek Joel Stew") is too ambiguous to split reliably and is skipped - if the same
     * team is described elsewhere with real delimiters (as it usually is, by a different
     * teammate), that version catches it instead.
     */
    private List<String> extractNameCandidates(String text) {
        if (text == null || text.isBlank()) return List.of();
        String working = text;
        Matcher paren = Pattern.compile("\\(([^)]+)\\)").matcher(text);
        if (paren.find()) {
            working = paren.group(1);
        } else if (text.contains("/")) {
            String[] parts = text.split("/");
            working = parts[parts.length - 1];
        } else if (!text.contains(",")) {
            return List.of();
        }

        List<String> out = new ArrayList<>();
        for (String part : working.split(",")) {
            for (String sub : part.split("(?i)\\s+and\\s+|\\s*&\\s*")) {
                String candidate = sub.trim();
                if (looksLikeName(candidate)) out.add(candidate);
            }
        }
        return out;
    }

    private static final Set<String> NAME_STOPWORDS = Set.of(
        "team", "hole", "squad", "crew", "group", "wrong", "mo", "town"
    );

    private boolean looksLikeName(String s) {
        if (s.isEmpty()) return false;
        String[] words = s.split("\\s+");
        if (words.length == 0 || words.length > 3) return false;
        for (String word : words) {
            if (!word.matches("[A-Za-z'.-]+")) return false;
            if (NAME_STOPWORDS.contains(word.toLowerCase())) return false;
        }
        return true;
    }

    /**
     * Cross-references everything else in the database for a name match - other events'
     * registrations, raffle entries, the player roster, and site accounts - so an admin
     * reviewing unmatched teammates can see who's actually reachable by email instead of
     * only being catchable in person. First match wins; stops at the first source that has
     * an email on file for this name.
     */
    private Map<String, Object> findKnownContact(String name) {
        String normalized = normalizeForSearch(name);

        for (EventRegistration r : registrationRepo.findAll()) {
            if (r.getPayerName() == null || r.getPayerEmail() == null || r.getPayerEmail().isBlank()) continue;
            if (isLikelyNameMatch(normalized, normalizeForSearch(r.getPayerName()))) {
                return Map.of("suggestedEmail", r.getPayerEmail(), "matchedFrom", "a previous event registration");
            }
        }
        for (RaffleEntry r : raffleEntryRepo.findAll()) {
            if (r.getPayerName() == null || r.getPayerEmail() == null || r.getPayerEmail().isBlank()) continue;
            if (isLikelyNameMatch(normalized, normalizeForSearch(r.getPayerName()))) {
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("suggestedEmail", r.getPayerEmail());
                if (r.getPayerPhone() != null && !r.getPayerPhone().isBlank()) out.put("suggestedPhone", r.getPayerPhone());
                out.put("matchedFrom", "a raffle entry");
                return out;
            }
        }
        for (Player p : playerRepo.findAll()) {
            if (p.getName() == null || p.getEmail() == null || p.getEmail().isBlank()) continue;
            if (isLikelyNameMatch(normalized, normalizeForSearch(p.getName()))) {
                return Map.of("suggestedEmail", p.getEmail(), "matchedFrom", "the player roster");
            }
        }
        for (UserAccount u : userAccountRepo.findAll()) {
            if (u.getDisplayName() == null || u.getEmail() == null || u.getEmail().isBlank()) continue;
            if (isLikelyNameMatch(normalized, normalizeForSearch(u.getDisplayName()))) {
                return Map.of("suggestedEmail", u.getEmail(), "matchedFrom", "an existing account");
            }
        }
        return null;
    }

    public record CreateUnmatchedRequest(List<UnmatchedEntry> entries) {}
    public record UnmatchedEntry(String name, String email) {}

    private String normalizeForSearch(String value) {
        if (value == null) return "";
        return value.toLowerCase().replaceAll("[^a-z0-9 ]", "").replaceAll("\\s+", " ").trim();
    }

    private boolean isLikelyNameMatch(String query, String candidate) {
        if (candidate.isEmpty()) return false;
        if (query.equals(candidate) || query.contains(candidate) || candidate.contains(query)) {
            return true;
        }
        String[] queryTokens = query.split(" ");
        String[] candidateTokens = candidate.split(" ");
        if (queryTokens.length > 0 && candidateTokens.length > 0) {
            String queryLast = queryTokens[queryTokens.length - 1];
            String candidateLast = candidateTokens[candidateTokens.length - 1];
            if (!queryLast.isEmpty() && queryLast.equals(candidateLast)) {
                return true;
            }
        }
        int threshold = Math.max(2, query.length() / 4);
        return levenshtein(query, candidate) <= threshold;
    }

    private int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }
        return dp[a.length()][b.length()];
    }

    public record PayExistingRequest(String paypalOrderId) {}

    // Public: submit registration after PayPal capture
    @PostMapping("/{id}/register")
    public ResponseEntity<?> register(
        @PathVariable UUID id,
        @RequestBody RegistrationPayload payload,
        @RequestHeader(value = "X-Program", defaultValue = "men") String program
    ) {
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null || event.isArchived()) return ResponseEntity.notFound().build();

        String teamNameFieldId = findTeamNameFieldId(event);
        String normalizedTeamName = getNormalizedTeamName(payload.formData(), teamNameFieldId);

        // Payment at registration is optional, even for priced events - registering with
        // no paypalOrderId just means "pay later" (paid=false, amountPaid=0 below), so an
        // admin can invoice or collect in person afterward. If a paypalOrderId IS given,
        // it's validated exactly as before: real, completed, unused, and matching the
        // event's price.
        boolean isFree = event.getPrice() == null || event.getPrice().compareTo(BigDecimal.ZERO) == 0;
        boolean hasPaymentRef = payload.paypalOrderId() != null && !payload.paypalOrderId().isBlank();
        boolean willBePaid = isFree || hasPaymentRef;
        if (hasPaymentRef) {
            if (registrationRepo.existsByPaypalOrderId(payload.paypalOrderId())) {
                return ResponseEntity.status(409).body("This payment has already been used for a registration.");
            }
            PaymentReceipt receipt = receiptRepo.findByOrderId(payload.paypalOrderId()).orElse(null);
            if (receipt == null) {
                return ResponseEntity.badRequest().body("Payment not found");
            }
            if (!"COMPLETED".equalsIgnoreCase(receipt.getStatus())) {
                return ResponseEntity.badRequest().body("Payment was not completed");
            }
            if (receipt.getAmount() == null || receipt.getAmount().compareTo(event.getPrice()) != 0) {
                return ResponseEntity.badRequest().body("Payment amount does not match this event's price");
            }
        }

        // Resolve or create team for team events
        UUID resolvedTeamId = null;
        if (event.getTeamSize() > 1) {
            if (payload.teamId() != null) {
                // Person B joining an existing team
                resolvedTeamId = payload.teamId();
            } else if (normalizedTeamName != null) {
                resolvedTeamId = findTeamIdByNormalizedName(id, normalizedTeamName, teamNameFieldId);
            }
            if (resolvedTeamId == null) {
                // Person A starting a new team
                EventTeam team = new EventTeam();
                team.setEventId(id);
                resolvedTeamId = teamRepo.save(team).getId();
            }
        }

        // Save registration
        EventRegistration reg = new EventRegistration();
        reg.setEventId(id);
        reg.setPayerName(payload.payerName() != null ? TextSanitizer.titleCaseName(payload.payerName()) : null);
        String normalizedPayerEmail = payload.payerEmail() != null ? payload.payerEmail().trim().toLowerCase() : null;
        reg.setPayerEmail(normalizedPayerEmail);
        reg.setPaypalOrderId(payload.paypalOrderId());
        reg.setAmountPaid(willBePaid && !isFree ? event.getPrice() : BigDecimal.ZERO);
        reg.setPaid(willBePaid);
        reg.setPaidAt(willBePaid ? Instant.now() : null);
        reg.setFormData(payload.formData() != null ? payload.formData() : "{}");
        reg.setTeamId(resolvedTeamId);

        List<String> teammateEmails = sanitizeTeammateEmails(payload.teammateEmails(), normalizedPayerEmail);
        reg.setTeammateEmails(teammateEmails);

        registrationRepo.save(reg);

        // Check if team is now complete
        if (resolvedTeamId != null) {
            long paidCount = registrationRepo.countByTeamIdAndPaidTrue(resolvedTeamId);
            if (paidCount >= event.getTeamSize()) {
                EventTeam team = teamRepo.findById(resolvedTeamId).orElse(null);
                if (team != null && !team.isComplete()) {
                    team.setComplete(true);
                    teamRepo.save(team);
                }
            }
        }

        notifyTeammates(event, program, reg.getPayerName(), reg.getPayerEmail(), teammateEmails);

        return ResponseEntity.ok(toRegResponse(reg));
    }

    @PostMapping("/admin/teams/backfill")
    public ResponseEntity<?> backfillTeams(
        HttpServletRequest httpRequest,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody BackfillTeamsRequest request
    ) {
        if (!isBoard(httpRequest, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        List<UUID> eventIds = request.eventIds() != null ? new ArrayList<>(request.eventIds()) : new ArrayList<>();
        if (eventIds.isEmpty()) {
            eventIds = eventRepo.findAllByOrderByStartTimeAsc().stream().map(Event::getId).toList();
        }

        int totalUpdated = 0;
        int totalTeamsCreated = 0;
        Map<String, Integer> eventsUpdated = new LinkedHashMap<>();

        for (UUID eventId : eventIds) {
            Event event = eventRepo.findById(eventId).orElse(null);
            if (event == null || event.getTeamSize() <= 1) continue;
            String fieldId = findTeamNameFieldId(event);
            if (fieldId == null) continue;
            BackfillStats stats = backfillEventTeams(event, fieldId);
            if (stats.updated > 0) {
                eventsUpdated.put(event.getId().toString(), stats.updated);
            }
            totalUpdated += stats.updated;
            totalTeamsCreated += stats.teamsCreated;
        }

        return ResponseEntity.ok(Map.of(
            "registrationsUpdated", totalUpdated,
            "teamsCreated", totalTeamsCreated,
            "events", eventsUpdated
        ));
    }

    @PostMapping("/{eventId}/teams/pair")
    public ResponseEntity<?> pairTeam(
        HttpServletRequest httpRequest,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody PairTeamRequest request
    ) {
        if (!isBoard(httpRequest, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Event event = eventRepo.findById(eventId).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        if (event.getTeamSize() <= 1) {
            return ResponseEntity.badRequest().body("Event is not a team event");
        }
        List<UUID> registrationIds = request.registrationIds();
        if (registrationIds == null || registrationIds.isEmpty()) {
            return ResponseEntity.badRequest().body("registrationIds required");
        }
        String teamName = TextSanitizer.clean(request.teamName());
        if (teamName == null || teamName.isBlank()) {
            return ResponseEntity.badRequest().body("teamName is required");
        }

        String fieldId = findTeamNameFieldId(event);
        if (fieldId == null) {
            return ResponseEntity.badRequest().body("Team name field not configured");
        }

        List<EventRegistration> regs = registrationRepo.findAllById(registrationIds)
            .stream()
            .filter(reg -> eventId.equals(reg.getEventId()))
            .collect(Collectors.toList());
        if (regs.isEmpty()) {
            return ResponseEntity.badRequest().body("No matching registrations found");
        }

        UUID teamId = regs.stream()
            .map(EventRegistration::getTeamId)
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(createTeam(eventId));

        for (EventRegistration reg : regs) {
            reg.setTeamId(teamId);
            reg.setFormData(setTeamNameInFormData(reg.getFormData(), fieldId, teamName));
        }

        registrationRepo.saveAll(regs);
        evaluateTeamCompletion(teamId, event);

        return ResponseEntity.ok(Map.of(
            "teamId", teamId,
            "teamName", teamName,
            "registrations", regs.stream().map(EventRegistration::getId).toList()
        ));
    }

    @PostMapping("/{eventId}/teams/{teamId}/remind")
    public ResponseEntity<?> remindTeam(
        HttpServletRequest httpRequest,
        @PathVariable UUID eventId,
        @PathVariable UUID teamId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody TeamReminderRequest request
    ) {
        if (!isBoard(httpRequest, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Event event = eventRepo.findById(eventId).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        EventTeam team = teamRepo.findById(teamId).orElse(null);
        if (team == null) return ResponseEntity.notFound().build();

        List<EventRegistration> members = registrationRepo.findAllByTeamId(teamId);
        if (members.isEmpty()) {
            return ResponseEntity.badRequest().body("Team has no registrations yet");
        }

        Set<String> registeredEmails = members.stream()
            .map(EventRegistration::getPayerEmail)
            .filter(Objects::nonNull)
            .map(email -> email.trim().toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());

        Set<String> pendingEmails = new LinkedHashSet<>();
        for (EventRegistration member : members) {
            for (String teammate : member.getTeammateEmails()) {
                if (teammate == null) continue;
                String trimmed = teammate.trim();
                if (trimmed.isEmpty()) continue;
                pendingEmails.add(trimmed);
            }
        }
        pendingEmails.removeIf(email -> registeredEmails.contains(email.toLowerCase(Locale.ROOT)));

        if (pendingEmails.isEmpty()) {
            return ResponseEntity.ok(Map.of("sentEmails", 0));
        }

        String emailProgram = request.program() != null ? request.program() : "men";
        Map<String, Object> prefill = buildPrefillData(members.get(0));
        String prefillJson = prefill.isEmpty() ? null : JsonUtils.toJson(prefill);
        String subject = "%s: Reminder to finish your team registration".formatted(event.getName());
        String teamNameFieldId = findTeamNameFieldId(event);
        String teamName = extractTeamName(members, teamNameFieldId);
        String captainName = members.get(0).getPayerName();
        String captainEmail = members.get(0).getPayerEmail();

        int sent = 0;
        for (String to : pendingEmails) {
            String link = buildTeamInviteLink(event, emailProgram, teamId, to, prefillJson);
            String body = buildTeamReminderBody(event, emailProgram, teamName, captainName, captainEmail, link);
            emailService.sendEmail(to, subject, body);
            sent++;
        }

        return ResponseEntity.ok(Map.of("sentEmails", sent));
    }

    // Helpers
    private void applyPayload(Event event, EventPayload payload) {
        if (payload.name() != null) {
            event.setName(TextSanitizer.clean(payload.name()));
        }
        // On create (no ID yet), generate a random alphanumeric slug
        if (event.getId() == null) {
            event.setSlug(UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        }
        if (payload.address() != null) {
            String addr = TextSanitizer.clean(payload.address());
            event.setAddress(addr);
            event.setMapsLink("https://www.google.com/maps/search/?api=1&query="
                + URLEncoder.encode(addr, StandardCharsets.UTF_8));
        }
        if (payload.startTime() != null) {
            event.setStartTime(Instant.parse(payload.startTime()));
        }
        if (payload.endTime() != null) {
            event.setEndTime(Instant.parse(payload.endTime()));
        }
        if (payload.description() != null) {
            event.setDescription(TextSanitizer.clean(payload.description()));
        }
        if (payload.fields() != null) {
            event.setFields(payload.fields());
        }
        if (payload.price() != null) {
            event.setPrice(payload.price());
        }
        if (payload.acceptsCash() != null) {
            event.setAcceptsCash(payload.acceptsCash());
        }
        if (payload.teamSize() != null) {
            event.setTeamSize(payload.teamSize());
        }
        if (payload.published() != null) {
            event.setPublished(payload.published());
        }
        if (payload.image() != null) {
            event.setImage(payload.image().isBlank() ? null : payload.image());
        }
    }

    private static final java.time.Duration IMAGE_TTL = S3Service.IMAGE_TTL;

    private EventResponse toResponse(Event e) {
        // Count registrations for this event
        long regCount = registrationRepo.findAllByEventId(e.getId()).size();
        return new EventResponse(
            e.getId(), e.getName(), e.getSlug(), e.getAddress(), e.getMapsLink(),
            e.getStartTime(), e.getEndTime(), e.getDescription(),
            s3Service.toPresignedUrl(e.getImage(), IMAGE_TTL),
            e.getFields(), e.getPrice(), e.isAcceptsCash(), e.getTeamSize(), e.isPublished(), e.isArchived(),
            regCount, e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private RegistrationResponse toRegResponse(EventRegistration r) {
        // Determine team completeness
        Boolean teamComplete = null;
        if (r.getTeamId() != null) {
            teamComplete = teamRepo.findById(r.getTeamId())
                .map(EventTeam::isComplete)
                .orElse(false);
        }
        return new RegistrationResponse(
            r.getId(), r.getEventId(), r.getPayerName(), r.getPayerEmail(),
            r.getPaypalOrderId(), r.getAmountPaid(), r.isPaid(), r.getPaidAt(),
            r.getFormData(), r.getTeamId(), r.getTeammateEmails(), teamComplete,
            r.getCreatedAt()
        );
    }

    private List<String> sanitizeTeammateEmails(List<String> emails, String payerEmail) {
        if (emails == null || emails.isEmpty()) {
            return List.of();
        }
        return emails.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(val -> !val.isBlank())
            .map(String::toLowerCase)
            .filter(val -> payerEmail == null || !val.equals(payerEmail))
            .distinct()
            .collect(Collectors.toList());
    }

    private Map<String, Object> buildPrefillData(EventRegistration registration) {
        if (registration == null) return Map.of();
        Map<String, Object> raw = JsonUtils.readMap(registration.getFormData());
        if (raw.isEmpty()) return Map.of();
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : raw.entrySet()) {
            Object value = entry.getValue();
            if (value == null) continue;
            String stringValue = value.toString().trim();
            if (stringValue.isEmpty()) continue;
            copy.put(entry.getKey(), value);
        }
        return copy;
    }

    private String buildTeamInviteLink(
        Event event,
        String program,
        UUID teamId,
        String email,
        String prefillJson
    ) {
        StringBuilder builder = new StringBuilder(buildEventLink(event, program));
        builder.append("?teamId=").append(teamId);
        if (email != null && !email.isBlank()) {
            builder.append("&teammateEmail=").append(URLEncoder.encode(email, StandardCharsets.UTF_8));
        }
        if (prefillJson != null && !prefillJson.isBlank()) {
            builder.append("&prefill=").append(URLEncoder.encode(prefillJson, StandardCharsets.UTF_8));
        }
        return builder.toString();
    }

    private String findTeamNameFieldId(Event event) {
        return findFieldIdByLabel(event, "team name");
    }

    private String findFieldIdByLabel(Event event, String labelContains) {
        if (event == null || event.getFields() == null) return null;
        for (Object obj : JsonUtils.readList(event.getFields())) {
            if (!(obj instanceof Map<?, ?> field)) continue;
            Object label = field.get("label");
            if (label == null || !label.toString().toLowerCase().contains(labelContains)) continue;
            Object id = field.get("id");
            if (id != null) return id.toString();
        }
        return null;
    }

    private static final Map<String, String> NUMBER_WORD_MAP = Map.ofEntries(
        Map.entry("zero", "0"),
        Map.entry("one", "1"),
        Map.entry("two", "2"),
        Map.entry("three", "3"),
        Map.entry("four", "4"),
        Map.entry("five", "5"),
        Map.entry("six", "6"),
        Map.entry("seven", "7"),
        Map.entry("eight", "8"),
        Map.entry("nine", "9"),
        Map.entry("ten", "10"),
        Map.entry("eleven", "11"),
        Map.entry("twelve", "12"),
        Map.entry("thirteen", "13"),
        Map.entry("fourteen", "14"),
        Map.entry("fifteen", "15"),
        Map.entry("sixteen", "16"),
        Map.entry("seventeen", "17"),
        Map.entry("eighteen", "18"),
        Map.entry("nineteen", "19"),
        Map.entry("twenty", "20")
    );

    private static final Pattern NUMBER_WORD_PATTERN = Pattern.compile(
        "\\b(" + String.join("|", NUMBER_WORD_MAP.keySet()) + ")\\b",
        Pattern.CASE_INSENSITIVE
    );

    private String getNormalizedTeamName(String formData, String fieldId) {
        String raw = getTeamNameFromFormData(formData, fieldId);
        return normalizeTeamNameForMatching(raw);
    }

    private BackfillStats backfillEventTeams(Event event, String fieldId) {
        List<EventRegistration> regs = registrationRepo.findAllByEventId(event.getId());
        Map<String, List<EventRegistration>> grouped = new LinkedHashMap<>();
        for (EventRegistration reg : regs) {
            String normalized = getNormalizedTeamName(reg.getFormData(), fieldId);
            if (normalized == null) continue;
            grouped.computeIfAbsent(normalized, key -> new ArrayList<>()).add(reg);
        }

        int updated = 0;
        int teamsCreated = 0;
        Set<UUID> canonicalIds = new LinkedHashSet<>();

        for (List<EventRegistration> bucket : grouped.values()) {
            if (bucket.isEmpty()) continue;
            UUID canonicalId = bucket.stream()
                .map(EventRegistration::getTeamId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
            if (canonicalId == null) {
                canonicalId = createTeam(event.getId());
                teamsCreated++;
            }
            canonicalIds.add(canonicalId);
            for (EventRegistration reg : bucket) {
                if (!canonicalId.equals(reg.getTeamId())) {
                    reg.setTeamId(canonicalId);
                    registrationRepo.save(reg);
                    updated++;
                }
            }
        }

        canonicalIds.forEach(teamId -> evaluateTeamCompletion(teamId, event));
        return new BackfillStats(updated, teamsCreated);
    }

    private static String getTeamNameFromFormData(String formData, String fieldId) {
        if (formData == null || fieldId == null) return null;
        Map<String, Object> data = JsonUtils.readMap(formData);
        Object value = data.get(fieldId);
        if (value == null) return null;
        String trimmed = value.toString().trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String setTeamNameInFormData(String formData, String fieldId, String teamName) {
        Map<String, Object> data = JsonUtils.readMap(formData);
        data.put(fieldId, teamName);
        return JsonUtils.toJson(data);
    }

    private static String normalizeTeamNameForMatching(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        String lower = trimmed.toLowerCase(Locale.ROOT);
        String replaced = replaceNumberWords(lower);
        String sanitized = replaced.replaceAll("[^a-z0-9]", "");
        return sanitized.isEmpty() ? null : sanitized;
    }

    private static String replaceNumberWords(String value) {
        Matcher matcher = NUMBER_WORD_PATTERN.matcher(value);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String replacement = NUMBER_WORD_MAP.get(matcher.group().toLowerCase(Locale.ROOT));
            matcher.appendReplacement(sb, replacement != null ? replacement : matcher.group());
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private UUID createTeam(UUID eventId) {
        EventTeam team = new EventTeam();
        team.setEventId(eventId);
        return teamRepo.save(team).getId();
    }

    private void evaluateTeamCompletion(UUID teamId, Event event) {
        if (teamId == null || event == null) return;
        long paidCount = registrationRepo.countByTeamIdAndPaidTrue(teamId);
        EventTeam team = teamRepo.findById(teamId).orElse(null);
        if (team == null) return;
        boolean shouldComplete = paidCount >= event.getTeamSize();
        if (team.isComplete() != shouldComplete) {
            team.setComplete(shouldComplete);
            teamRepo.save(team);
        }
    }

    private record BackfillStats(int updated, int teamsCreated) {}

    private UUID findTeamIdByNormalizedName(UUID eventId, String normalizedName, String fieldId) {
        if (normalizedName == null || fieldId == null) return null;
        for (EventRegistration reg : registrationRepo.findAllByEventId(eventId)) {
            if (reg.getTeamId() == null) continue;
            String existingName = getTeamNameFromFormData(reg.getFormData(), fieldId);
            String normalizedExisting = normalizeTeamNameForMatching(existingName);
            if (normalizedName.equals(normalizedExisting)) {
                return reg.getTeamId();
            }
        }
        return null;
    }

    private String extractTeamName(List<EventRegistration> members, String fieldId) {
        if (fieldId == null || members == null) return null;
        for (EventRegistration reg : members) {
            Map<String, Object> data = JsonUtils.readMap(reg.getFormData());
            Object value = data.get(fieldId);
            if (value == null) continue;
            String trimmed = value.toString().trim();
            if (!trimmed.isEmpty()) {
                return trimmed;
            }
        }
        return null;
    }

    private String buildTeamReminderBody(
        Event event,
        String program,
        String teamName,
        String captainName,
        String captainEmail,
        String link
    ) {
        String programLabel = programLabel(program);
        String identity = (captainName != null && !captainName.isBlank())
            ? captainName
            : (captainEmail != null && !captainEmail.isBlank() ? captainEmail : "A teammate");
        String teamText = teamName != null
            ? "Your team <strong>" + teamName + "</strong> still needs to finish registration for this event."
            : "Your team still needs to finish registration for this event.";
        String contact = (captainEmail != null && !captainEmail.isBlank())
            ? "<p>Have questions? Reply to " + captainEmail + ".</p>"
            : "";

        String body = EmailTemplate.paragraph("Hi there,")
            + EmailTemplate.paragraph(identity + " has invited you to join Missouri State " + programLabel
                + " Lacrosse for <strong>" + event.getName() + "</strong>.")
            + EmailTemplate.paragraph(teamText)
            + EmailTemplate.paragraph("The link below will pre-fill the team-specific info we already captured so you can finish fast:")
            + EmailTemplate.button(link, "Complete Your Registration")
            + contact;
        return EmailTemplate.wrap(programLabel, body);
    }

    private void notifyTeammates(
        Event event,
        String program,
        String payerName,
        String payerEmail,
        List<String> teammateEmails
    ) {
        if (event == null || teammateEmails == null || teammateEmails.isEmpty()) {
            return;
        }
        String programLabel = programLabel(program);
        String link = buildEventLink(event, program);
        String identity = (payerName != null && !payerName.isBlank())
            ? payerName
            : (payerEmail != null && !payerEmail.isBlank() ? payerEmail : "A teammate");
        String contactLine = (payerEmail != null && !payerEmail.isBlank())
            ? "Have questions? Reply to " + payerEmail + "."
            : "";
        String contactSection = contactLine.isBlank() ? "" : contactLine + "\n\n";
        String subject = "%s Lacrosse: You're invited to join %s".formatted(programLabel, event.getName());
        String body = """
            Hi there,

            %s has registered for Missouri State %s Lacrosse and listed you as a teammate for %s.
            Complete your registration here:
            %s

            %s
            Go Bears!
            - Missouri State %s Lacrosse
            """.formatted(
            identity,
            programLabel,
            event.getName(),
            link,
            contactSection,
            programLabel
        );

        for (String to : teammateEmails) {
            if (to != null && !to.isBlank()) {
                emailService.sendEmail(to, subject, body);
            }
        }
    }

    private String buildEventLink(Event event, String program) {
        String base = frontendBaseUrl != null ? frontendBaseUrl.replaceAll("/+$", "") : "";
        String programPath = "women".equalsIgnoreCase(program) ? "/women" : "";
        StringBuilder link = new StringBuilder();
        if (!base.isEmpty()) {
            link.append(base);
        }
        link.append(programPath);
        link.append("/event-signup/");
        link.append(event.getSlug());
        return link.toString();
    }

    private String programLabel(String program) {
        return "women".equalsIgnoreCase(program) ? "Women's" : "Men's";
    }

    // Records
    public record EventPayload(
        String name,
        String address,
        String startTime,
        String endTime,
        String description,
        String fields,
        BigDecimal price,
        Boolean acceptsCash,
        Integer teamSize,
        Boolean published,
        String image
    ) {}

    public record EventResponse(
        UUID id,
        String name,
        String slug,
        String address,
        String mapsLink,
        Instant startTime,
        Instant endTime,
        String description,
        String image,
        String fields,
        BigDecimal price,
        boolean acceptsCash,
        int teamSize,
        boolean published,
        boolean archived,
        long registrationCount,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record RegistrationPayload(
        String paypalOrderId,
        String payerName,
        String payerEmail,
        String formData,
        List<String> teammateEmails,
        UUID teamId
    ) {}

    public record RegistrationResponse(
        UUID id,
        UUID eventId,
        String payerName,
        String payerEmail,
        String paypalOrderId,
        BigDecimal amountPaid,
        boolean paid,
        Instant paidAt,
        String formData,
        UUID teamId,
        List<String> teammateEmails,
        Boolean teamComplete,
        Instant createdAt
    ) {}

    public record TeamCheckResponse(
        boolean found,
        UUID teamId,
        String registrantName,
        String registrantEmail
    ) {}

    public record TeamReminderRequest(
        String program
    ) {}

    public record BackfillTeamsRequest(
        List<UUID> eventIds
    ) {}

    public record PairTeamRequest(
        List<UUID> registrationIds,
        String teamName
    ) {}

    // --- Onsite POS items + sales (Tap to Pay app) ---------------------------------------

    @GetMapping("/{eventId}/pos-items")
    public ResponseEntity<?> listPosItems(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        return ResponseEntity.ok(posItemRepo.findAllByEventIdOrderBySortOrderAsc(eventId));
    }

    @PostMapping("/{eventId}/pos-items")
    public ResponseEntity<?> addPosItem(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody PosItemRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        if (body.name() == null || body.name().isBlank() || body.price() == null || body.price().signum() <= 0) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Name and a positive price are required"));
        }
        EventPosItem item = new EventPosItem();
        item.setEventId(eventId);
        item.setName(TextSanitizer.clean(body.name()));
        item.setPrice(body.price());
        return ResponseEntity.ok(posItemRepo.save(item));
    }

    @DeleteMapping("/pos-items/{itemId}")
    public ResponseEntity<?> deletePosItem(
        HttpServletRequest request,
        @PathVariable UUID itemId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        posItemRepo.deleteById(itemId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Pulls every Tap to Pay payment from the last {@code days} days straight from Stripe and
     * records any the webhook missed: the receipt, and the registrant marked paid. Safe to run
     * any number of times. The report is Stripe's own count and total, so it doubles as the
     * number to reconcile the event totals against.
     */
    @PostMapping("/terminal-sync")
    public ResponseEntity<?> terminalSync(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestParam(defaultValue = "7") int days
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        if (!stripeService.isEnabled()) {
            return ResponseEntity.status(503).body(new ErrorResponse("Stripe is not enabled"));
        }
        int window = Math.max(1, Math.min(days, 90));
        try {
            TerminalPaymentRecorder.SyncReport report =
                terminalPaymentRecorder.sync(Instant.now().minus(java.time.Duration.ofDays(window)));
            return ResponseEntity.ok(Map.of(
                "days", window,
                "stripePayments", report.succeeded,
                "stripeTotal", BigDecimal.valueOf(report.totalCents, 2),
                "newlyRecorded", report.newlyRecorded,
                "newlyMarkedPaid", report.newlyMarkedPaid,
                "chargedMoreThanOnce", report.chargedMoreThanOnce
            ));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /** What actually sold at this event's Tap to Pay register, itemized. */
    @GetMapping("/{eventId}/pos-sales")
    public ResponseEntity<?> posSales(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        String source = "event-pos-" + eventId;
        List<PaymentReceipt> receipts = receiptRepo.findAll().stream()
            .filter(r -> source.equals(r.getSource()) && "COMPLETED".equalsIgnoreCase(r.getStatus()))
            .toList();

        Map<String, int[]> byItem = new LinkedHashMap<>(); // name -> [qty, totalCents]
        BigDecimal grandTotal = BigDecimal.ZERO;
        for (PaymentReceipt r : receipts) {
            grandTotal = grandTotal.add(r.getAmount() != null ? r.getAmount() : BigDecimal.ZERO);
            Map<String, Object> payload = JsonUtils.readMap(r.getPayload());
            Object itemsObj = payload.get("items");
            if (itemsObj instanceof List<?> items) {
                for (Object o : items) {
                    if (!(o instanceof Map<?, ?> itemMap)) continue;
                    String name = String.valueOf(itemMap.get("name"));
                    int qty = itemMap.get("qty") instanceof Number n ? n.intValue() : 1;
                    int priceCents = itemMap.get("priceCents") instanceof Number n ? n.intValue() : 0;
                    int[] agg = byItem.computeIfAbsent(name, k -> new int[2]);
                    agg[0] += qty;
                    agg[1] += qty * priceCents;
                }
            }
        }

        List<Map<String, Object>> breakdown = byItem.entrySet().stream()
            .map(e -> Map.<String, Object>of(
                "name", e.getKey(),
                "quantitySold", e.getValue()[0],
                "revenue", BigDecimal.valueOf(e.getValue()[1], 2)
            ))
            .toList();

        // Registration payments (online, Tap to Pay registration mode, cash) are tracked under
        // their own source tags, so they're reported beside the POS sales, not mixed into them.
        java.util.Set<String> registrationSources = java.util.Set.of("event-" + eventId, "event-registration-" + eventId);
        List<PaymentReceipt> registrationReceipts = receiptRepo.findAll().stream()
            .filter(r -> registrationSources.contains(r.getSource()) && "COMPLETED".equalsIgnoreCase(r.getStatus()) && !r.isVoided())
            .toList();
        BigDecimal registrationTotal = registrationReceipts.stream()
            .map(r -> r.getAmount() != null ? r.getAmount() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ResponseEntity.ok(Map.of(
            "saleCount", receipts.size(),
            "grandTotal", grandTotal,
            "items", breakdown,
            "registrationCount", registrationReceipts.size(),
            "registrationTotal", registrationTotal
        ));
    }

    public record PosItemRequest(String name, BigDecimal price) {}

    // --- Manual payment tracking + bulk invoicing -----------------------------------------

    /**
     * Lets an admin fix a registrant's name, email, or any of the event's custom fields
     * (phone, team name, etc) - e.g. correcting a name entered via the unmatched-teammates
     * scan, or fixing a typo'd email. Payment status is untouched here; use mark-paid/pay
     * for that. Fields are only overwritten when actually present in the request, same
     * merge behavior as applyPayload() for events.
     */
    @PutMapping("/{eventId}/registrations/{regId}")
    public ResponseEntity<?> updateRegistration(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @PathVariable UUID regId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody UpdateRegistrationRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        EventRegistration reg = registrationRepo.findById(regId).orElse(null);
        if (reg == null || !eventId.equals(reg.getEventId())) {
            return ResponseEntity.notFound().build();
        }
        if (body.payerName() != null) {
            reg.setPayerName(TextSanitizer.titleCaseName(body.payerName()));
        }
        if (body.payerEmail() != null) {
            String trimmed = body.payerEmail().trim();
            reg.setPayerEmail(trimmed.isEmpty() ? null : trimmed.toLowerCase());
        }
        if (body.formData() != null) {
            Map<String, Object> merged = new LinkedHashMap<>(JsonUtils.readMap(reg.getFormData()));
            merged.putAll(TextSanitizer.cleanMap(body.formData()));
            reg.setFormData(JsonUtils.toJson(merged));
        }
        return ResponseEntity.ok(toRegResponse(registrationRepo.save(reg)));
    }

    public record UpdateRegistrationRequest(
        String payerName,
        String payerEmail,
        Map<String, Object> formData
    ) {}

    /** For cash, check, or any payment collected outside Stripe/PayPal. */
    @PutMapping("/{eventId}/registrations/{regId}/mark-paid")
    public ResponseEntity<?> markPaid(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @PathVariable UUID regId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody(required = false) MarkPaidRequest body
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        EventRegistration reg = registrationRepo.findById(regId).orElse(null);
        if (reg == null || !eventId.equals(reg.getEventId())) {
            return ResponseEntity.notFound().build();
        }
        Event event = eventRepo.findById(eventId).orElse(null);
        reg.setPaid(true);
        reg.setPaidAt(Instant.now());
        BigDecimal amount = body != null && body.amount() != null
            ? body.amount()
            : (reg.getAmountPaid() != null && reg.getAmountPaid().signum() > 0
                ? reg.getAmountPaid()
                : (event != null && event.getPrice() != null ? event.getPrice() : BigDecimal.ZERO));
        reg.setAmountPaid(amount);
        return ResponseEntity.ok(toRegResponse(registrationRepo.save(reg)));
    }

    /**
     * Removes a registrant entirely (they bailed, double-signed-up, etc.) - not the same as
     * marking unpaid, which keeps their spot on the list. If they were on a team, re-checks
     * whether the team still has enough paid members to count as complete.
     */
    @DeleteMapping("/{eventId}/registrations/{regId}")
    public ResponseEntity<?> removeRegistration(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @PathVariable UUID regId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        EventRegistration reg = registrationRepo.findById(regId).orElse(null);
        if (reg == null || !eventId.equals(reg.getEventId())) {
            return ResponseEntity.notFound().build();
        }
        UUID teamId = reg.getTeamId();
        registrationRepo.delete(reg);

        if (teamId != null) {
            Event event = eventRepo.findById(eventId).orElse(null);
            EventTeam team = teamRepo.findById(teamId).orElse(null);
            if (team != null && event != null) {
                long paidCount = registrationRepo.countByTeamIdAndPaidTrue(teamId);
                if (paidCount < event.getTeamSize() && team.isComplete()) {
                    team.setComplete(false);
                    teamRepo.save(team);
                }
            }
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * Sends a real Stripe Invoice (not a Checkout Session - this is Stripe's separate
     * invoicing product, emailed directly by Stripe with its own pay link) to every unpaid
     * registrant with an email on file.
     */
    @PostMapping("/{eventId}/invoice-unpaid")
    public ResponseEntity<?> invoiceUnpaid(
        HttpServletRequest request,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        }
        if (!stripeService.isEnabled()) {
            return ResponseEntity.status(503).body(new ErrorResponse("Stripe is not enabled"));
        }
        Event event = eventRepo.findById(eventId).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        if (event.getPrice() == null || event.getPrice().signum() <= 0) {
            return ResponseEntity.badRequest().body(new ErrorResponse("This event has no price set"));
        }

        List<EventRegistration> unpaid = registrationRepo.findAllByEventId(eventId).stream()
            .filter(r -> !r.isPaid() && r.getPayerEmail() != null && !r.getPayerEmail().isBlank())
            .toList();

        int sent = 0;
        List<String> failures = new ArrayList<>();
        long priceCents = event.getPrice().movePointRight(2).longValueExact();

        for (EventRegistration reg : unpaid) {
            try {
                Customer customer = findOrCreateCustomer(reg.getPayerEmail(), reg.getPayerName());

                String itemDescription = event.getName() + " - registration";
                deleteStalePendingItems(customer.getId(), itemDescription);

                // Create the invoice empty (EXCLUDE pending items), then attach the line item
                // directly to it by id. Never sweeping pending items means a leftover item on
                // the customer can't double the total, and the item can't miss the invoice.
                InvoiceCreateParams invoiceParams = InvoiceCreateParams.builder()
                    .setCustomer(customer.getId())
                    .setCollectionMethod(InvoiceCreateParams.CollectionMethod.SEND_INVOICE)
                    .setDaysUntilDue(14L)
                    .setDescription("Missouri State Lacrosse - " + event.getName())
                    .setPendingInvoiceItemsBehavior(InvoiceCreateParams.PendingInvoiceItemsBehavior.EXCLUDE)
                    // Lets the webhook (StripeController, "invoice.paid") mark exactly this
                    // registration paid once Stripe tells us the customer actually paid it.
                    .putMetadata("registrationId", reg.getId().toString())
                    .putMetadata("eventId", eventId.toString())
                    .putMetadata("program", program)
                    .build();
                Invoice invoice = Invoice.create(invoiceParams);

                InvoiceItemCreateParams itemParams = InvoiceItemCreateParams.builder()
                    .setCustomer(customer.getId())
                    .setInvoice(invoice.getId())
                    .setAmount(priceCents)
                    .setCurrency("usd")
                    .setDescription(itemDescription)
                    .build();
                InvoiceItem.create(itemParams);

                invoice = Invoice.retrieve(invoice.getId());
                if (invoice.getAmountDue() == null || invoice.getAmountDue() != priceCents) {
                    invoice.delete();
                    failures.add(reg.getPayerEmail() + ": invoice total came out wrong, not sent");
                    continue;
                }
                invoice = invoice.finalizeInvoice();
                invoice.sendInvoice();
                sent++;
            } catch (StripeException e) {
                failures.add(reg.getPayerEmail() + ": " + e.getMessage());
            }
        }

        return ResponseEntity.ok(Map.of("invoicesSent", sent, "failures", failures));
    }

    /** Removes orphaned, never-invoiced items for this event left by the old $0-invoice bug. */
    private void deleteStalePendingItems(String customerId, String description) throws StripeException {
        InvoiceItemListParams params = InvoiceItemListParams.builder()
            .setCustomer(customerId)
            .setPending(true)
            .setLimit(100L)
            .build();
        for (InvoiceItem item : InvoiceItem.list(params).getData()) {
            if (description.equals(item.getDescription())) {
                item.delete();
            }
        }
    }

    private Customer findOrCreateCustomer(String email, String name) throws StripeException {
        CustomerListParams listParams = CustomerListParams.builder().setEmail(email).setLimit(1L).build();
        CustomerCollection existing = Customer.list(listParams);
        if (!existing.getData().isEmpty()) {
            return existing.getData().get(0);
        }
        CustomerCreateParams createParams = CustomerCreateParams.builder()
            .setEmail(email)
            .setName(name != null && !name.isBlank() ? name : email)
            .build();
        return Customer.create(createParams);
    }

    public record MarkPaidRequest(BigDecimal amount) {}
}
