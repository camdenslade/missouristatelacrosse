package com.mostate.lacrosse.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;

/**
 * Thin wrapper over the Stripe Java SDK, mirroring {@link PayPalSDKService}. A
 * Checkout Session stands in for a PayPal order: its id ("cs_...") becomes the
 * {@code payment_receipts.order_id}, and {@link #toReceiptPayload(Session)} reshapes a
 * paid session into the same map a PayPal capture produces so the existing
 * {@link PaymentReceiptService} recorder and every downstream verifier work unchanged.
 */
@Service
public class StripeService {

    @Value("${stripe.secret-key:}")
    private String secretKey;

    @Value("${stripe.publishable-key:}")
    private String publishableKey;

    @Value("${stripe.webhook-secret:}")
    private String webhookSecret;

    @Value("${stripe.enabled:true}")
    private boolean enabled;

    @PostConstruct
    private void init() {
        if (secretKey != null && !secretKey.isBlank()) {
            Stripe.apiKey = secretKey;
        }
        boolean configured = secretKey != null && !secretKey.isBlank();
        System.out.println("[StripeService] enabled=" + isEnabled()
            + " configured=" + configured
            + (configured ? " (" + (secretKey.startsWith("sk_live") ? "LIVE" : "TEST") + ")" : ""));
    }

    /** True only when Stripe is both switched on and has a secret key. */
    public boolean isEnabled() {
        return enabled && secretKey != null && !secretKey.isBlank();
    }

    public String getPublishableKey() {
        return publishableKey == null ? "" : publishableKey;
    }

    /**
     * Creates an embedded Checkout Session for a one-off payment of {@code amountUsd}
     * (a plain decimal string like "42.00"). No redirect on completion — the browser
     * stays on the site and drives confirmation via the onComplete callback.
     */
    public Session createEmbeddedCheckout(String amountUsd, String source, String program) throws StripeException {
        long unitAmount = new BigDecimal(amountUsd)
            .movePointRight(2)
            .setScale(0, java.math.RoundingMode.HALF_UP)
            .longValueExact();

        String label = productLabel(source);

        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setUiMode(SessionCreateParams.UiMode.EMBEDDED)
            .setRedirectOnCompletion(SessionCreateParams.RedirectOnCompletion.NEVER)
            .putMetadata("source", source == null ? "" : source)
            .putMetadata("program", program == null ? "" : program)
            .putMetadata("kind", "laxsite")
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency("usd")
                            .setUnitAmount(unitAmount)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(label)
                                    .build())
                            .build())
                    .build())
            .build();

        return Session.create(params);
    }

    public Session retrieveSession(String sessionId) throws StripeException {
        return Session.retrieve(sessionId);
    }

    public Event verifyWebhook(String payload, String signatureHeader) throws SignatureVerificationException {
        return Webhook.constructEvent(payload, signatureHeader, webhookSecret);
    }

    public boolean isPaid(Session session) {
        return session != null && "paid".equalsIgnoreCase(session.getPaymentStatus());
    }

    /** The {@code source} tag chosen at create time (dues, fundraiser, stream, ...). */
    public String sourceOf(Session session) {
        return metaValue(session, "source");
    }

    /** The owning program ("men" / "women") stamped at create time. */
    public String programOf(Session session) {
        return metaValue(session, "program");
    }

    private static String metaValue(Session session, String key) {
        if (session == null || session.getMetadata() == null) {
            return null;
        }
        String v = session.getMetadata().get(key);
        return v == null || v.isBlank() ? null : v;
    }

    /**
     * Reshapes a paid Checkout Session into the exact map shape
     * {@link PaymentReceiptService#recordReceipt} expects from a PayPal capture.
     */
    public Map<String, Object> toReceiptPayload(Session session) {
        String value = session.getAmountTotal() == null
            ? "0.00"
            : BigDecimal.valueOf(session.getAmountTotal()).movePointLeft(2).setScale(2).toPlainString();

        Map<String, Object> amount = new HashMap<>();
        amount.put("currency_code", "USD");
        amount.put("value", value);

        Map<String, Object> unit = new HashMap<>();
        unit.put("amount", amount);

        Map<String, Object> payer = new HashMap<>();
        payer.put("email_address", payerEmail(session));
        Map<String, Object> name = payerName(session);
        if (name != null) {
            payer.put("name", name);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", session.getId());
        payload.put("status", "COMPLETED");
        payload.put("payer", payer);
        payload.put("purchase_units", List.of(unit));
        return payload;
    }

    private static String payerEmail(Session session) {
        if (session.getCustomerDetails() != null && session.getCustomerDetails().getEmail() != null) {
            return session.getCustomerDetails().getEmail();
        }
        return session.getCustomerEmail();
    }

    // Stripe gives a single display name; the receipt payload mirrors PayPal's
    // { given_name, surname } split so the success pages render it unchanged.
    private static Map<String, Object> payerName(Session session) {
        if (session.getCustomerDetails() == null) {
            return null;
        }
        String full = session.getCustomerDetails().getName();
        if (full == null || full.isBlank()) {
            return null;
        }
        full = full.trim();
        int split = full.indexOf(' ');
        Map<String, Object> name = new HashMap<>();
        if (split > 0) {
            name.put("given_name", full.substring(0, split));
            name.put("surname", full.substring(split + 1).trim());
        } else {
            name.put("given_name", full);
            name.put("surname", "");
        }
        return name;
    }

    private static String productLabel(String source) {
        if (source == null || source.isBlank()) {
            return "Missouri State Lacrosse";
        }
        return switch (source.toLowerCase()) {
            case "dues" -> "Missouri State Lacrosse - Dues";
            case "fundraiser" -> "Missouri State Lacrosse - Fundraiser";
            case "stream" -> "Missouri State Lacrosse - Stream Access";
            case "pay" -> "Missouri State Lacrosse - Event Registration";
            default -> "Missouri State Lacrosse";
        };
    }
}
