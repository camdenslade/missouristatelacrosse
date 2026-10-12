package com.mostate.lacrosse.Controller;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.stripe.exception.StripeException;
import com.stripe.model.terminal.ConnectionToken;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.terminal.ConnectionTokenCreateParams;
import jakarta.validation.constraints.NotNull;

/**
 * Onsite Stripe Terminal (Tap to Pay on iPhone) support for the single-purpose event-day
 * app, e.g. the golf tournament drink stand. Deliberately not tied to the site's Cognito
 * login - a static shared secret gates both endpoints instead, since the person running
 * the register at an event may not have (or need) a site account.
 */
@RestController
@RequestMapping("/api/terminal")
public class TerminalController {

    @Value("${app.terminal.secret:}")
    private String sharedSecret;

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
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(body.amountCents())
                .setCurrency("usd")
                .addPaymentMethodType("card_present")
                .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.AUTOMATIC)
                .build();
            PaymentIntent intent = PaymentIntent.create(params);
            return ResponseEntity.ok(Map.of(
                "clientSecret", intent.getClientSecret(),
                "id", intent.getId()
            ));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    public record PaymentIntentRequest(@NotNull Long amountCents) {}
}
