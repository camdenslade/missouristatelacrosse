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
import com.mostate.lacrosse.Service.PaymentReceiptService;
import com.mostate.lacrosse.Service.StripeService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
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

    public StripeController(StripeService stripeService, PaymentReceiptService receiptService) {
        this.stripeService = stripeService;
        this.receiptService = receiptService;
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
        return ResponseEntity.ok(Map.of("received", true));
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
