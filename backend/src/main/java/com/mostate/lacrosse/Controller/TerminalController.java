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
import com.mostate.lacrosse.Repository.EventPosItemRepository;
import com.mostate.lacrosse.Repository.EventRepository;
import com.mostate.lacrosse.Service.EmailService;
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
    private final EmailService emailService;

    public TerminalController(
        EventRepository eventRepository,
        EventPosItemRepository posItemRepository,
        EmailService emailService
    ) {
        this.eventRepository = eventRepository;
        this.posItemRepository = posItemRepository;
        this.emailService = emailService;
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
            List<Map<String, String>> events = eventRepository.findAllByOrderByStartTimeAsc().stream()
                .map(e -> Map.of(
                    "id", e.getId().toString(),
                    "name", e.getName(),
                    "startTime", e.getStartTime() != null ? e.getStartTime().toString() : ""
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
        try {
            PaymentIntent intent = PaymentIntent.retrieve(body.paymentIntentId());
            if (!"succeeded".equals(intent.getStatus())) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Payment has not succeeded"));
            }

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
            String body_ = EmailTemplate.paragraph("Thank you for your purchase!")
                + (itemsHtml.length() > 0 ? EmailTemplate.paragraph(itemsHtml.toString()) : "")
                + EmailTemplate.paragraph("<b>Total: $" + amount + "</b>");

            emailService.sendEmail(
                body.email(),
                "Missouri State Lacrosse - Receipt",
                EmailTemplate.wrap(programLabel, body_)
            );
            return ResponseEntity.ok(Map.of("sent", true));
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
