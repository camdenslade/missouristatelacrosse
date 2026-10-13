package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.EventRegistration;
import com.mostate.lacrosse.Repository.EventRegistrationRepository;
import com.mostate.lacrosse.Service.PaymentReceiptService;
import com.mostate.lacrosse.Service.StripeService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.PaymentIntent;
import com.stripe.model.checkout.Session;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * Stripe counterpart to {@link PayPalController}. Same create/confirm shape; the
 * webhook is the source of truth and confirm is an idempotent fast-path for the UI.
 * Every paid session is written into {@code payment_receipts} in the exact shape a
 * PayPal capture produces, so dues / raffle / event / store logic is untouched.
 */
@RestController
@RequestMapping("/api/stripe")
@Validated
public class StripeController {

    private static final BigDecimal SHIPPING_FEE = BigDecimal.valueOf(5);

    private final StripeService stripeService;
    private final PaymentReceiptService receiptService;
    private final EventRegistrationRepository registrationRepository;

    public StripeController(
        StripeService stripeService,
        PaymentReceiptService receiptService,
        EventRegistrationRepository registrationRepository
    ) {
        this.stripeService = stripeService;
        this.receiptService = receiptService;
        this.registrationRepository = registrationRepository;
    }

    @GetMapping("/config")
    public ResponseEntity<?> config() {
        return ResponseEntity.ok(Map.of(
            "publishableKey", stripeService.getPublishableKey(),
            "enabled", stripeService.isEnabled()
        ));
    }

    @PostMapping("/create")
    public ResponseEntity<?> create(@Valid @RequestBody CreateSessionRequest body) {
        if (!stripeService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("Stripe payments are not enabled"));
        }
        try {
            BigDecimal amount = new BigDecimal(body.amount());
            if (Boolean.TRUE.equals(body.includeShippingFee())) {
                amount = amount.add(SHIPPING_FEE);
            }
            if (amount.signum() <= 0) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
            }
            String formatted = amount.setScale(2, RoundingMode.HALF_UP).toPlainString();

            // Program is resolved by ProgramFilter from the X-Program header the browser
            // sends; stamp it on the session so the (header-less) webhook can write to
            // the right tenant schema.
            String program = TenantContext.getTenant();
            Session session = stripeService.createEmbeddedCheckout(formatted, body.source(), program);

            // Lock the source to this session id now, exactly as PayPal's /create does,
            // so a later confirm/webhook can't relabel the payment.
            if (body.source() != null && !body.source().isBlank()) {
                receiptService.reserveSource(session.getId(), body.source(), "stripe");
            }

            return ResponseEntity.ok(Map.of(
                "id", session.getId(),
                "clientSecret", session.getClientSecret()
            ));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * UI fast-path after the embedded checkout's onComplete fires. Idempotent: returns
     * the stored payload if the webhook already landed, otherwise pulls the session
     * from Stripe and records it. Response shape matches PayPal's /capture.
     */
    @PostMapping("/confirm")
    public ResponseEntity<?> confirm(@RequestParam String sessionId) {
        try {
            var cached = receiptService.findStoredPayload(sessionId);
            if (cached.isPresent()) {
                return ResponseEntity.ok(cached.get());
            }
            Session session = stripeService.retrieveSession(sessionId);
            if (!stripeService.isPaid(session)) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Payment not completed"));
            }
            Map<String, Object> payload = stripeService.toReceiptPayload(session);
            receiptService.recordReceipt(payload, stripeService.sourceOf(session), "stripe");
            return ResponseEntity.ok(payload);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(
        @RequestBody String payload,
        @RequestHeader(name = "Stripe-Signature", required = false) String signature
    ) {
        Event event;
        try {
            event = stripeService.verifyWebhook(payload, signature);
        } catch (SignatureVerificationException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid signature"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Malformed webhook"));
        }

        String type = event.getType();
        if ("checkout.session.completed".equals(type)
            || "checkout.session.async_payment_succeeded".equals(type)) {
            try {
                String sessionId = sessionIdOf(event);
                if (sessionId != null) {
                    Session session = stripeService.retrieveSession(sessionId);
                    if (stripeService.isPaid(session)) {
                        String program = stripeService.programOf(session);
                        if (program != null) {
                            TenantContext.setTenant(program);
                        }
                        try {
                            receiptService.recordReceipt(
                                stripeService.toReceiptPayload(session),
                                stripeService.sourceOf(session),
                                "stripe"
                            );
                        } finally {
                            TenantContext.clear();
                        }
                    }
                }
            } catch (Exception e) {
                // Log and 500 so Stripe retries — recordReceipt is idempotent via order_id.
                e.printStackTrace();
                return ResponseEntity.internalServerError().body(new ErrorResponse("Processing failed"));
            }
        }

        // Onsite Stripe Terminal (Tap to Pay) sale - tagged by TerminalController when the
        // PaymentIntent was created. Recorded as a payment_receipts row like any other
        // payment, so it shows up in the budget ledger automatically.
        if ("payment_intent.succeeded".equals(type)) {
            try {
                PaymentIntent intent = paymentIntentOf(event);
                if (intent != null && "true".equals(intent.getMetadata().get("terminalSale"))) {
                    String program = intent.getMetadata().getOrDefault("program", "men");
                    String eventId = intent.getMetadata().get("eventId");
                    String registrationId = intent.getMetadata().get("registrationId");
                    String source = registrationId != null && !registrationId.isBlank()
                        ? "event-registration-" + eventId
                        : (eventId != null && !eventId.isBlank()) ? "event-pos-" + eventId : "pos-sale";

                    Map<String, Object> receiptPayload = new java.util.LinkedHashMap<>(Map.of(
                        "id", intent.getId(),
                        "status", "COMPLETED",
                        "payer", Map.of(),
                        "purchase_units", java.util.List.of(Map.of(
                            "amount", Map.of(
                                "value", java.math.BigDecimal.valueOf(intent.getAmount(), 2).toPlainString(),
                                "currency_code", intent.getCurrency().toUpperCase()
                            )
                        ))
                    ));
                    String itemsJson = intent.getMetadata().get("items");
                    if (itemsJson != null && !itemsJson.isBlank()) {
                        receiptPayload.put("items", com.mostate.lacrosse.Utils.JsonUtils.readList(itemsJson));
                    }

                    TenantContext.setTenant(program);
                    try {
                        receiptService.recordReceipt(receiptPayload, source, "stripe-terminal");
                        // Registration mode (vs generic POS): this charge was for one
                        // specific unpaid registrant, picked off a list in the app - mark
                        // that exact registration paid now that Stripe confirms it went through.
                        if (registrationId != null && !registrationId.isBlank()) {
                            markRegistrationPaid(registrationId, intent);
                        }
                    } finally {
                        TenantContext.clear();
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                return ResponseEntity.internalServerError().body(new ErrorResponse("Processing failed"));
            }
        }

        // A Stripe Invoice sent via the bulk "Invoice Unpaid" button (EventsController)
        // was actually paid - mark that registration paid too, same as a Checkout/Terminal
        // payment would. This is the only way we find out an invoice got paid.
        if ("invoice.paid".equals(type)) {
            try {
                Invoice invoice = invoiceOf(event);
                if (invoice != null) {
                    Map<String, String> metadata = invoice.getMetadata();
                    String registrationId = metadata != null ? metadata.get("registrationId") : null;
                    if (registrationId != null && !registrationId.isBlank()) {
                        String program = metadata.getOrDefault("program", "men");
                        String eventId = metadata.get("eventId");
                        TenantContext.setTenant(program);
                        try {
                            markRegistrationPaidFromInvoice(registrationId, eventId, invoice);
                        } finally {
                            TenantContext.clear();
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                return ResponseEntity.internalServerError().body(new ErrorResponse("Processing failed"));
            }
        }
        return ResponseEntity.ok(Map.of("received", true));
    }

    private void markRegistrationPaid(String registrationId, PaymentIntent intent) {
        registrationRepository.findById(java.util.UUID.fromString(registrationId)).ifPresent(reg -> {
            if (reg.isPaid()) return;
            reg.setPaid(true);
            reg.setPaidAt(java.time.Instant.now());
            BigDecimal current = reg.getAmountPaid() != null ? reg.getAmountPaid() : BigDecimal.ZERO;
            reg.setAmountPaid(current.add(BigDecimal.valueOf(intent.getAmount(), 2)));
            reg.setPaypalOrderId(intent.getId());
            registrationRepository.save(reg);
        });
    }

    private void markRegistrationPaidFromInvoice(String registrationId, String eventId, Invoice invoice) {
        registrationRepository.findById(java.util.UUID.fromString(registrationId)).ifPresent(reg -> {
            if (reg.isPaid()) return;
            reg.setPaid(true);
            reg.setPaidAt(java.time.Instant.now());
            BigDecimal current = reg.getAmountPaid() != null ? reg.getAmountPaid() : BigDecimal.ZERO;
            reg.setAmountPaid(current.add(BigDecimal.valueOf(invoice.getAmountPaid(), 2)));
            reg.setPaypalOrderId(invoice.getId());
            registrationRepository.save(reg);
        });
    }

    private static Invoice invoiceOf(Event event) {
        EventDataObjectDeserializer d = event.getDataObjectDeserializer();
        if (d.getObject().isPresent() && d.getObject().get() instanceof Invoice inv) {
            return inv;
        }
        return null;
    }

    private static PaymentIntent paymentIntentOf(Event event) {
        EventDataObjectDeserializer d = event.getDataObjectDeserializer();
        if (d.getObject().isPresent() && d.getObject().get() instanceof PaymentIntent pi) {
            return pi;
        }
        return null;
    }

    private static String sessionIdOf(Event event) {
        EventDataObjectDeserializer d = event.getDataObjectDeserializer();
        if (d.getObject().isPresent() && d.getObject().get() instanceof Session s) {
            return s.getId();
        }
        Map<String, Object> raw = JsonUtils.readMap(d.getRawJson());
        Object id = raw.get("id");
        return id == null ? null : String.valueOf(id);
    }

    public record CreateSessionRequest(@NotBlank String amount, Boolean includeShippingFee, String source) {}
}
