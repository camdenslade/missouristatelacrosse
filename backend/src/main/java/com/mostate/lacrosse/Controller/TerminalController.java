package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Event;
import com.mostate.lacrosse.Model.EventRegistration;
import com.mostate.lacrosse.Repository.EventPosItemRepository;
import com.mostate.lacrosse.Repository.EventRegistrationRepository;
import com.mostate.lacrosse.Repository.EventRepository;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PaymentReceiptService;
import com.mostate.lacrosse.Utils.EmailTemplate;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.stripe.exception.StripeException;
import com.stripe.model.terminal.ConnectionToken;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.terminal.ConnectionTokenCreateParams;
import jakarta.validation.constraints.NotNull;

/**
 * Onsite Stripe Terminal (Tap to Pay on iPhone) support for the single-purpose event-day
 * app, e.g. the golf tournament drink stand. Deliberately not tied to the site's Cognito
 * login - a static shared secret gates every endpoint instead, since the person running
 * the register at an event may not have (or need) a site account. Not covered by
 * ProgramFilter (see its exemption for "/api/terminal/"), so every endpoint here that
 * touches tenant data sets TenantContext itself from the "program" param.
 */
@RestController
@RequestMapping("/api/terminal")
public class TerminalController {

    @Value("${app.terminal.secret:}")
    private String sharedSecret;

    private final EventRepository eventRepository;
    private final EventPosItemRepository posItemRepository;
    private final EventRegistrationRepository registrationRepository;
    private final EmailService emailService;
    private final PaymentReceiptService receiptService;

    public TerminalController(
        EventRepository eventRepository,
        EventPosItemRepository posItemRepository,
        EventRegistrationRepository registrationRepository,
        EmailService emailService,
        PaymentReceiptService receiptService
    ) {
        this.eventRepository = eventRepository;
        this.posItemRepository = posItemRepository;
        this.registrationRepository = registrationRepository;
        this.emailService = emailService;
        this.receiptService = receiptService;
    }

    private boolean isAuthorized(String provided) {
        return sharedSecret != null && !sharedSecret.isBlank()
            && provided != null && provided.equals(sharedSecret);
    }

    @PostMapping("/connection-token")
    public ResponseEntity<?> connectionToken(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        try {
            ConnectionToken token = ConnectionToken.create(ConnectionTokenCreateParams.builder().build());
            return ResponseEntity.ok(Map.of("secret", token.getSecret()));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /** Lets the app show a picker of events to tie a day's sales to (e.g. "Golf Tournament"). */
    @GetMapping("/events")
    public ResponseEntity<?> events(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        try {
            TenantContext.setTenant("women".equalsIgnoreCase(program) ? "women" : "men");
            List<Map<String, Object>> events = eventRepository.findAllByOrderByStartTimeAsc().stream()
                .map(e -> Map.<String, Object>of(
                    "id", e.getId().toString(),
                    "name", e.getName(),
                    "startTime", e.getStartTime() != null ? e.getStartTime().toString() : "",
                    "acceptsCash", e.isAcceptsCash()
                ))
                .toList();
            return ResponseEntity.ok(events);
        } finally {
            TenantContext.clear();
        }
    }

    /** The tappable item list for one event (set up ahead of time from the admin dashboard). */
    @GetMapping("/events/{eventId}/items")
    public ResponseEntity<?> eventItems(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        try {
            TenantContext.setTenant("women".equalsIgnoreCase(program) ? "women" : "men");
            List<Map<String, Object>> items = posItemRepository.findAllByEventIdOrderBySortOrderAsc(eventId).stream()
                .map(i -> Map.<String, Object>of(
                    "id", i.getId().toString(),
                    "name", i.getName(),
                    "priceCents", i.getPrice().movePointRight(2).intValueExact()
                ))
                .toList();
            return ResponseEntity.ok(items);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Registration mode: the list of people who registered for this event but haven't
     * paid yet, so the person running the register can tap to charge them one at a time
     * and check them off, instead of taking generic POS sales.
     */
    @GetMapping("/events/{eventId}/unpaid-registrants")
    public ResponseEntity<?> unpaidRegistrants(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @PathVariable UUID eventId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        try {
            TenantContext.setTenant("women".equalsIgnoreCase(program) ? "women" : "men");
            Event event = eventRepository.findById(eventId).orElse(null);
            if (event == null) return ResponseEntity.notFound().build();
            java.math.BigDecimal price = event.getPrice() != null ? event.getPrice() : java.math.BigDecimal.ZERO;
            List<Map<String, Object>> rows = registrationRepository.findAllByEventId(eventId).stream()
                .filter(r -> !r.isPaid())
                .map(r -> {
                    java.math.BigDecimal alreadyPaid = r.getAmountPaid() != null ? r.getAmountPaid() : java.math.BigDecimal.ZERO;
                    java.math.BigDecimal due = price.subtract(alreadyPaid);
                    return Map.<String, Object>of(
                        "id", r.getId().toString(),
                        "payerName", r.getPayerName() != null ? r.getPayerName() : "",
                        "payerEmail", r.getPayerEmail() != null ? r.getPayerEmail() : "",
                        "amountDueCents", due.movePointRight(2).intValueExact()
                    );
                })
                .toList();
            return ResponseEntity.ok(rows);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Registration mode: charge one specific unpaid registrant for exactly what they owe.
     * The webhook (StripeController) marks that registration paid when this succeeds -
     * see its "registrationId" metadata branch.
     */
    @PostMapping("/registrations/{registrationId}/payment-intent")
    public ResponseEntity<?> createRegistrationPaymentIntent(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @PathVariable UUID registrationId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        try {
            TenantContext.setTenant("women".equalsIgnoreCase(program) ? "women" : "men");
            EventRegistration reg = registrationRepository.findById(registrationId).orElse(null);
            if (reg == null) return ResponseEntity.notFound().build();
            if (reg.isPaid()) {
                return ResponseEntity.badRequest().body(new ErrorResponse("This registrant is already marked paid"));
            }
            Event event = eventRepository.findById(reg.getEventId()).orElse(null);
            if (event == null) return ResponseEntity.notFound().build();
            java.math.BigDecimal price = event.getPrice() != null ? event.getPrice() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal alreadyPaid = reg.getAmountPaid() != null ? reg.getAmountPaid() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal due = price.subtract(alreadyPaid);
            if (due.signum() <= 0) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Nothing owed on this registration"));
            }
            long amountCents = due.movePointRight(2).longValueExact();

            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(amountCents)
                .setCurrency("usd")
                .addPaymentMethodType("card_present")
                .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.AUTOMATIC)
                .putMetadata("terminalSale", "true")
                .putMetadata("registrationId", registrationId.toString())
                .putMetadata("eventId", reg.getEventId().toString())
                .putMetadata("program", "women".equalsIgnoreCase(program) ? "women" : "men")
                .build();
            PaymentIntent intent = PaymentIntent.create(params);
            return ResponseEntity.ok(Map.of(
                "clientSecret", intent.getClientSecret(),
                "id", intent.getId(),
                "payerEmail", reg.getPayerEmail() != null ? reg.getPayerEmail() : ""
            ));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Registration mode's cash option: marks a registrant paid immediately, no Stripe
     * webhook involved since there's no card charge to wait on. Recorded with provider
     * "cash" (see PaymentReceiptService.recordReceipt) so reporting can tell it apart from
     * a card payment even though both land in payment_receipts the same way.
     */
    @PostMapping("/registrations/{registrationId}/cash-payment")
    public ResponseEntity<?> recordCashRegistrationPayment(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @PathVariable UUID registrationId,
        @RequestBody CashPaymentRequest body,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        if (body.amountCents() == null || body.amountCents() <= 0) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
        }
        try {
            TenantContext.setTenant("women".equalsIgnoreCase(program) ? "women" : "men");
            EventRegistration reg = registrationRepository.findById(registrationId).orElse(null);
            if (reg == null) return ResponseEntity.notFound().build();
            if (reg.isPaid()) {
                return ResponseEntity.badRequest().body(new ErrorResponse("This registrant is already marked paid"));
            }
            Event event = eventRepository.findById(reg.getEventId()).orElse(null);
            if (event == null) return ResponseEntity.notFound().build();
            if (!event.isAcceptsCash()) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Cash payments are not enabled for this event"));
            }
            java.math.BigDecimal price = event.getPrice() != null ? event.getPrice() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal alreadyPaid = reg.getAmountPaid() != null ? reg.getAmountPaid() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal due = price.subtract(alreadyPaid);
            if (due.signum() <= 0) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Nothing owed on this registration"));
            }

            String cashId = "cash-" + UUID.randomUUID();
            java.math.BigDecimal amount = java.math.BigDecimal.valueOf(body.amountCents(), 2);

            reg.setPaid(true);
            reg.setPaidAt(java.time.Instant.now());
            reg.setAmountPaid(alreadyPaid.add(amount));
            reg.setPaypalOrderId(cashId);
            registrationRepository.save(reg);

            Map<String, Object> payload = Map.of(
                "id", cashId,
                "status", "COMPLETED",
                "payer", Map.of(),
                "purchase_units", List.of(Map.of(
                    "amount", Map.of("value", amount.toPlainString(), "currency_code", "USD")
                ))
            );
            receiptService.recordReceipt(payload, "event-registration-" + reg.getEventId(), "cash");

            return ResponseEntity.ok(Map.of("id", cashId));
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * POS mode's cash option: records a cash sale against an event the same way a card
     * sale would, just without a Stripe PaymentIntent in the middle.
     */
    @PostMapping("/cash-sale")
    public ResponseEntity<?> recordCashSale(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @RequestBody CashSaleRequest body
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        if (body.amountCents() == null || body.amountCents() <= 0) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
        }
        if (body.eventId() == null || body.eventId().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Select an event that accepts cash"));
        }
        String program = "women".equalsIgnoreCase(body.program()) ? "women" : "men";
        try {
            TenantContext.setTenant(program);
            Event event = eventRepository.findById(UUID.fromString(body.eventId())).orElse(null);
            if (event == null) return ResponseEntity.notFound().build();
            if (!event.isAcceptsCash()) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Cash payments are not enabled for this event"));
            }
            String cashId = "cash-" + UUID.randomUUID();
            java.math.BigDecimal amount = java.math.BigDecimal.valueOf(body.amountCents(), 2);
            String source = "event-pos-" + body.eventId();

            Map<String, Object> payload = new java.util.LinkedHashMap<>(Map.of(
                "id", cashId,
                "status", "COMPLETED",
                "payer", Map.of(),
                "purchase_units", List.of(Map.of(
                    "amount", Map.of("value", amount.toPlainString(), "currency_code", "USD")
                ))
            ));
            if (body.items() != null && !body.items().isEmpty()) {
                payload.put("items", body.items());
            }
            receiptService.recordReceipt(payload, source, "cash");

            return ResponseEntity.ok(Map.of("id", cashId));
        } finally {
            TenantContext.clear();
        }
    }

    public record CashPaymentRequest(@NotNull Long amountCents) {}

    public record CashSaleRequest(
        @NotNull Long amountCents,
        String eventId,
        String program,
        List<SoldItem> items
    ) {}

    /**
     * Registration mode's "send receipt" button - no typed-in email, just sends to
     * whatever email the registrant gave when they signed up.
     */
    @PostMapping("/registrations/{registrationId}/receipt")
    public ResponseEntity<?> sendRegistrationReceipt(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @PathVariable UUID registrationId,
        @RequestBody ReceiptRequest body,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        if (body.paymentIntentId() == null || body.paymentIntentId().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("paymentIntentId is required"));
        }
        try {
            TenantContext.setTenant("women".equalsIgnoreCase(program) ? "women" : "men");
            EventRegistration reg = registrationRepository.findById(registrationId).orElse(null);
            if (reg == null || reg.getPayerEmail() == null || reg.getPayerEmail().isBlank()) {
                return ResponseEntity.badRequest().body(new ErrorResponse("No email on file for this registrant"));
            }
            return sendReceiptTo(reg.getPayerEmail(), body.paymentIntentId());
        } finally {
            TenantContext.clear();
        }
    }

    @PostMapping("/payment-intent")
    public ResponseEntity<?> createPaymentIntent(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @RequestBody PaymentIntentRequest body
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        if (body.amountCents() == null || body.amountCents() <= 0) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
        }
        try {
            PaymentIntentCreateParams.Builder paramsBuilder = PaymentIntentCreateParams.builder()
                .setAmount(body.amountCents())
                .setCurrency("usd")
                .addPaymentMethodType("card_present")
                .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.AUTOMATIC);

            // Tagged as metadata so the webhook (StripeController) can record this sale
            // against the right event/program when the charge completes.
            if (body.eventId() != null && !body.eventId().isBlank()) {
                paramsBuilder.putMetadata("eventId", body.eventId());
            }
            paramsBuilder.putMetadata("program", "women".equalsIgnoreCase(body.program()) ? "women" : "men");
            paramsBuilder.putMetadata("terminalSale", "true");
            // The tapped items, for the sales breakdown report. Stripe metadata values cap
            // at 500 chars, fine for a handful of items from a small catalog.
            if (body.items() != null && !body.items().isEmpty()) {
                paramsBuilder.putMetadata("items", JsonUtils.toJson(body.items()));
            }

            PaymentIntent intent = PaymentIntent.create(paramsBuilder.build());
            return ResponseEntity.ok(Map.of(
                "clientSecret", intent.getClientSecret(),
                "id", intent.getId()
            ));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Optional, customer-entered at the register after a successful charge. Looked up live
     * from Stripe rather than payment_receipts, since the webhook that writes that row may
     * not have landed yet by the time the customer types their email.
     */
    @PostMapping("/receipt")
    public ResponseEntity<?> sendReceipt(
        @RequestHeader(name = "X-Terminal-Secret", required = false) String secret,
        @RequestBody ReceiptRequest body
    ) {
        if (!isAuthorized(secret)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        if (body.paymentIntentId() == null || body.paymentIntentId().isBlank()
                || body.email() == null || body.email().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("paymentIntentId and email are required"));
        }
        return sendReceiptTo(body.email(), body.paymentIntentId());
    }

    /**
     * Sends a receipt regardless of whether the charge actually succeeded - the person
     * running the register may want to hand over a record of a declined/failed attempt
     * too (e.g. for their own books, or because the customer asked "can you email me what
     * just happened"). The email wording just reflects whatever Stripe says the outcome was.
     */
    private ResponseEntity<?> sendReceiptTo(String email, String paymentIntentId) {
        try {
            PaymentIntent intent = PaymentIntent.retrieve(paymentIntentId);
            boolean succeeded = "succeeded".equals(intent.getStatus());

            String amount = java.math.BigDecimal.valueOf(intent.getAmount(), 2).toPlainString();
            StringBuilder itemsHtml = new StringBuilder();
            String itemsJson = intent.getMetadata().get("items");
            if (itemsJson != null && !itemsJson.isBlank()) {
                for (Object o : JsonUtils.readList(itemsJson)) {
                    if (o instanceof Map<?, ?> item) {
                        int qty = item.get("qty") instanceof Number n ? n.intValue() : 1;
                        int cents = item.get("priceCents") instanceof Number n ? n.intValue() : 0;
                        itemsHtml.append(qty).append(" x ").append(item.get("name"))
                            .append(" - $").append(java.math.BigDecimal.valueOf((long) qty * cents, 2))
                            .append("<br>");
                    }
                }
            }

            String programLabel = "women".equals(intent.getMetadata().get("program")) ? "Women's" : "Men's";
            String subject;
            String body_;
            if (succeeded) {
                subject = "Missouri State Lacrosse - Receipt";
                body_ = EmailTemplate.paragraph("Thank you for your purchase!")
                    + (itemsHtml.length() > 0 ? EmailTemplate.paragraph(itemsHtml.toString()) : "")
                    + EmailTemplate.paragraph("<b>Total: $" + amount + "</b>");
            } else {
                String reason = intent.getLastPaymentError() != null && intent.getLastPaymentError().getMessage() != null
                    ? intent.getLastPaymentError().getMessage()
                    : "the card was not charged";
                subject = "Missouri State Lacrosse - Payment Not Completed";
                body_ = EmailTemplate.paragraph("This payment attempt did not go through.")
                    + (itemsHtml.length() > 0 ? EmailTemplate.paragraph(itemsHtml.toString()) : "")
                    + EmailTemplate.paragraph("Attempted amount: $" + amount)
                    + EmailTemplate.paragraph("Reason: " + reason)
                    + EmailTemplate.paragraph("No charge was made to your card. Please see someone at the register to try again.");
            }

            emailService.sendEmail(email, subject, EmailTemplate.wrap(programLabel, body_));
            return ResponseEntity.ok(Map.of("sent", true, "succeeded", succeeded));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    public record ReceiptRequest(String paymentIntentId, String email) {}

    public record SoldItem(String name, int qty, int priceCents) {}

    public record PaymentIntentRequest(
        @NotNull Long amountCents,
        String eventId,
        String program,
        List<SoldItem> items
    ) {}
}
