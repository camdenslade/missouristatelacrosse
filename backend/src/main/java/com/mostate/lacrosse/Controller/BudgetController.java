package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.BudgetEntry;
import com.mostate.lacrosse.Model.DuesPayment;
import com.mostate.lacrosse.Model.Event;
import com.mostate.lacrosse.Model.Fundraiser;
import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.Raffle;
import com.mostate.lacrosse.Repository.BudgetEntryRepository;
import com.mostate.lacrosse.Repository.DuesPaymentRepository;
import com.mostate.lacrosse.Repository.EventRepository;
import com.mostate.lacrosse.Repository.FundraiserRepository;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.RaffleRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Utils.SeasonUtil;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Treasurer's budget ledger. A flat, chronological, per-season record of every dollar that
 * actually moved: real payments pulled live from payment_receipts (dues/raffles/events/
 * fundraisers/store - whatever "source" tags it as) plus dues_payments CREDIT rows (cash
 * recorded by an admin outside the normal payment flow, e.g. "paid directly"), plus manual
 * income/expense entries for everything else. Nothing here is ever double-counted: a dues
 * payment made through Stripe/PayPal shows up once, via its payment_receipts row, not
 * again via dues_payments (that table's PAYMENT rows just link the same receipt to a
 * player's balance; CHARGE rows adjust what a player owes, not real cash, so they're
 * excluded entirely).
 */
@RestController
@RequestMapping("/api/budget")
public class BudgetController {
    // Stripe's standard US rate (2.9% + $0.30). PayPal's is close enough that a single
    // estimate is fine here - this is "roughly how much actually lands in the account",
    // not a reconciled statement. Only applied to processor-captured rows; cash/check
    // entries (dues-manual, plain manual entries) never had a cut taken.
    private static final BigDecimal PROCESSOR_RATE = new BigDecimal("0.029");
    private static final BigDecimal PROCESSOR_FLAT_FEE = new BigDecimal("0.30");

    private static BigDecimal estimateNet(BigDecimal gross) {
        BigDecimal fee = gross.multiply(PROCESSOR_RATE).add(PROCESSOR_FLAT_FEE);
        BigDecimal net = gross.subtract(fee);
        return net.signum() > 0 ? net.setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;
    }
    private final PaymentReceiptRepository receiptRepo;
    private final DuesPaymentRepository duesRepo;
    private final BudgetEntryRepository entryRepo;
    private final PlayerRepository playerRepo;
    private final AuthorizationService authorizationService;
    private final EventRepository eventRepo;
    private final RaffleRepository raffleRepo;
    private final FundraiserRepository fundraiserRepo;

    public BudgetController(
        PaymentReceiptRepository receiptRepo,
        DuesPaymentRepository duesRepo,
        BudgetEntryRepository entryRepo,
        PlayerRepository playerRepo,
        AuthorizationService authorizationService,
        EventRepository eventRepo,
        RaffleRepository raffleRepo,
        FundraiserRepository fundraiserRepo
    ) {
        this.receiptRepo = receiptRepo;
        this.duesRepo = duesRepo;
        this.entryRepo = entryRepo;
        this.playerRepo = playerRepo;
        this.authorizationService = authorizationService;
        this.eventRepo = eventRepo;
        this.raffleRepo = raffleRepo;
        this.fundraiserRepo = fundraiserRepo;
    }

    private boolean isTreasurer(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isTreasurerOrAbove(uid, program, token);
    }

    @GetMapping
    public ResponseEntity<?> ledger(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestParam String season
    ) {
        if (!isTreasurer(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Treasurer access required"));
        }

        List<Row> rows = new ArrayList<>();

        for (PaymentReceipt r : receiptRepo.findAll()) {
            if (!"COMPLETED".equalsIgnoreCase(r.getStatus())) continue;
            if (r.isVoided()) continue;
            LocalDate date = toDate(r.getCreatedAt());
            if (!season.equals(SeasonUtil.currentSeason(date))) continue;
            BigDecimal gross = r.getAmount() != null ? r.getAmount() : BigDecimal.ZERO;
            rows.add(new Row(
                date, describeSource(r), gross, estimateNet(gross), "income",
                r.getSource() != null ? r.getSource() : "payment", null, r.getId()
            ));
        }

        for (DuesPayment d : duesRepo.findAll()) {
            if (!"CREDIT".equalsIgnoreCase(d.getType())) continue;
            LocalDate date = toDate(d.getCreatedAt());
            if (!season.equals(SeasonUtil.currentSeason(date))) continue;
            String playerName = playerRepo.findById(d.getPlayerId()).map(Player::getName).orElse("Unknown player");
            String desc = "Dues - " + playerName + (d.getNote() != null && !d.getNote().isBlank() ? " (" + d.getNote() + ")" : "");
            // Manually recorded ("paid directly") - no processor took a cut.
            rows.add(new Row(date, desc, d.getAmount(), d.getAmount(), "income", "dues-manual", null, null));
        }

        for (BudgetEntry e : entryRepo.findAll()) {
            if (!season.equals(SeasonUtil.currentSeason(e.getEntryDate()))) continue;
            rows.add(new Row(e.getEntryDate(), e.getDescription(), e.getAmount(), e.getAmount(), e.getEntryType(), "manual", e.getId(), null));
        }

        rows.sort(Comparator.comparing((Row r) -> r.date));

        BigDecimal running = BigDecimal.ZERO;
        List<Map<String, Object>> withRunningTotal = new ArrayList<>();
        for (Row r : rows) {
            BigDecimal signedNet = "expense".equals(r.type) ? r.netAmount.negate() : r.netAmount;
            running = running.add(signedNet);
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("date", r.date);
            row.put("description", r.description);
            row.put("amount", r.amount);
            row.put("netAmount", r.netAmount);
            row.put("type", r.type);
            row.put("source", r.source);
            row.put("manualEntryId", r.manualEntryId != null ? r.manualEntryId : "");
            row.put("receiptId", r.receiptId != null ? r.receiptId : "");
            row.put("runningTotal", running);
            withRunningTotal.add(row);
        }

        return ResponseEntity.ok(Map.of("season", season, "entries", withRunningTotal, "total", running));
    }

    @PostMapping("/entries")
    public ResponseEntity<?> addEntry(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody EntryRequest body
    ) {
        if (!isTreasurer(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Treasurer access required"));
        }
        if (body.description() == null || body.description().isBlank()
                || body.amount() == null || body.amount().signum() <= 0
                || body.entryDate() == null
                || (!"income".equals(body.entryType()) && !"expense".equals(body.entryType()))) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Type, description, a positive amount, and date are required"));
        }
        BudgetEntry entry = new BudgetEntry();
        entry.setEntryType(body.entryType());
        entry.setAmount(body.amount());
        entry.setDescription(TextSanitizer.clean(body.description()));
        entry.setEntryDate(body.entryDate());
        entry.setCreatedBy((String) request.getAttribute("firebaseUid"));
        return ResponseEntity.ok(entryRepo.save(entry));
    }

    @DeleteMapping("/entries/{id}")
    public ResponseEntity<?> deleteEntry(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isTreasurer(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Treasurer access required"));
        }
        entryRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Excludes a specific payment_receipts row from the ledger - a duplicate Tap to Pay
     * charge from testing, or anything later refunded through Stripe/PayPal directly
     * (there's no refund webhook wired up yet, so the ledger never finds out on its own).
     * Never deletes the row or touches real money, just stops counting it as income.
     */
    @PostMapping("/receipts/{id}/void")
    public ResponseEntity<?> voidReceipt(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isTreasurer(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Treasurer access required"));
        }
        PaymentReceipt receipt = receiptRepo.findById(id).orElse(null);
        if (receipt == null) return ResponseEntity.notFound().build();
        receipt.setVoided(true);
        receiptRepo.save(receipt);
        return ResponseEntity.noContent().build();
    }

    private LocalDate toDate(Instant instant) {
        return instant.atZone(ZoneOffset.UTC).toLocalDate();
    }

    private static final Pattern UUID_PATTERN = Pattern.compile(
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    );

    /**
     * Turns a source tag like "event-registration-80de032e-..." or "raffle-<uuid>" into an
     * actual event/raffle/fundraiser name instead of showing the raw tag, and appends who
     * paid (every receipt already carries a payer name/email from checkout). Falls back to
     * just the payer when the source has no resolvable id, and to "Payment" when there's
     * nothing at all - still strictly more useful than before either way.
     */
    private String describeSource(PaymentReceipt r) {
        String source = r.getSource();
        String who = r.getPayerName() != null && !r.getPayerName().isBlank()
            ? r.getPayerName()
            : (r.getPayerEmail() != null && !r.getPayerEmail().isBlank() ? r.getPayerEmail() : null);
        String suffix = who != null ? " (" + who + ")" : "";

        if (source == null || source.isBlank()) return "Payment" + suffix;
        if (source.equals("dues") || source.equals("dues-manual")) return "Dues payment" + suffix;
        if (source.equals("pos-sale")) return "POS sale" + suffix;
        if (source.startsWith("store") || source.startsWith("custom-product")) return "Team store" + suffix;
        if (source.startsWith("donate")) return "Donation" + suffix;

        Matcher idMatcher = UUID_PATTERN.matcher(source);
        String uuidPart = idMatcher.find() ? idMatcher.group() : null;

        if (source.startsWith("raffle") && uuidPart != null) {
            try {
                Raffle raffle = raffleRepo.findById(UUID.fromString(uuidPart)).orElse(null);
                if (raffle != null) return "Raffle - " + raffle.getName() + suffix;
            } catch (IllegalArgumentException ignored) { }
        }
        if (source.startsWith("fundraiser")) {
            String slug = source.substring("fundraiser-".length());
            Fundraiser fundraiser = fundraiserRepo.findBySlug(slug).orElse(null);
            if (fundraiser != null) return "Fundraiser - " + fundraiser.getTitle() + suffix;
        }
        if (source.startsWith("event") && uuidPart != null) {
            try {
                Event event = eventRepo.findById(UUID.fromString(uuidPart)).orElse(null);
                String label = source.contains("registration") ? " (registration)"
                    : source.contains("pos") ? " (POS sale)" : "";
                if (event != null) return "Event - " + event.getName() + label + suffix;
            } catch (IllegalArgumentException ignored) { }
        }

        // Unrecognized/unresolvable tag - still better than the raw source string.
        return (source.startsWith("raffle") ? "Raffle" : source.startsWith("event") ? "Event" : source) + suffix;
    }

    private record Row(
        LocalDate date, String description, BigDecimal amount, BigDecimal netAmount,
        String type, String source, UUID manualEntryId, UUID receiptId
    ) {}

    public record EntryRequest(String entryType, BigDecimal amount, String description, LocalDate entryDate) {}
}
