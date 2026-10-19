package com.mostate.lacrosse.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Repository.EventRegistrationRepository;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentListParams;

/**
 * Records a succeeded Tap to Pay PaymentIntent: a payment_receipts row (which feeds the POS
 * total and the budget) and, in registration mode, the registrant marked paid. The webhook
 * calls this for each payment_intent.succeeded event, and sync() pulls the same payments
 * straight from Stripe so a missing or misconfigured webhook can never lose a sale again.
 * Safe to repeat: receipts are keyed by the PaymentIntent id and paid registrations are skipped.
 */
@Service
public class TerminalPaymentRecorder {
    private static final long SAFETY_NET_LOOKBACK_SECONDS = 2 * 24 * 60 * 60;

    private final PaymentReceiptService receiptService;
    private final PaymentReceiptRepository receiptRepository;
    private final EventRegistrationRepository registrationRepository;
    private final StripeService stripeService;

    public TerminalPaymentRecorder(
        PaymentReceiptService receiptService,
        PaymentReceiptRepository receiptRepository,
        EventRegistrationRepository registrationRepository,
        StripeService stripeService
    ) {
        this.receiptService = receiptService;
        this.receiptRepository = receiptRepository;
        this.registrationRepository = registrationRepository;
        this.stripeService = stripeService;
    }

    public enum Outcome { NOT_TERMINAL, ALREADY_RECORDED, RECORDED, RECORDED_AND_MARKED_PAID }

    public Outcome record(PaymentIntent intent) {
        Map<String, String> metadata = intent.getMetadata();
        if (metadata == null || !"true".equals(metadata.get("terminalSale"))) return Outcome.NOT_TERMINAL;
        if (!"succeeded".equals(intent.getStatus()) || intent.getAmount() == null || intent.getAmount() <= 0) {
            return Outcome.NOT_TERMINAL;
        }

        String program = "women".equals(metadata.get("program")) ? "women" : "men";
        String eventId = metadata.get("eventId");
        String registrationId = metadata.get("registrationId");
        boolean isRegistration = registrationId != null && !registrationId.isBlank();
        String source = isRegistration
            ? "event-registration-" + eventId
            : (eventId != null && !eventId.isBlank()) ? "event-pos-" + eventId : "pos-sale";

        TenantContext.setTenant(program);
        try {
            boolean existed = receiptRepository.findByOrderId(intent.getId()).isPresent();
            if (!existed) {
                PaymentReceipt receipt = receiptService.recordReceipt(receiptPayload(intent), source, "stripe-terminal");
                // Date it by the charge, not by when we heard about it, so a backfill lands
                // on the right day in the budget.
                receipt.setCreatedAt(Instant.ofEpochSecond(intent.getCreated()));
                receiptRepository.save(receipt);
            }
            boolean markedPaid = isRegistration && markRegistrationPaid(registrationId, intent);
            if (markedPaid) return Outcome.RECORDED_AND_MARKED_PAID;
            return existed ? Outcome.ALREADY_RECORDED : Outcome.RECORDED;
        } finally {
            TenantContext.clear();
        }
    }

    /** Pulls every Tap to Pay payment created since {@code since} from Stripe and records any we missed. */
    public SyncReport sync(Instant since) throws StripeException {
        PaymentIntentListParams params = PaymentIntentListParams.builder()
            .setCreated(PaymentIntentListParams.Created.builder().setGte(since.getEpochSecond()).build())
            .setLimit(100L)
            .build();
        SyncReport report = new SyncReport();
        Map<String, List<String>> intentsByRegistration = new LinkedHashMap<>();
        for (PaymentIntent intent : PaymentIntent.list(params).autoPagingIterable()) {
            Outcome outcome = record(intent);
            if (outcome == Outcome.NOT_TERMINAL) continue;
            report.succeeded++;
            report.totalCents += intent.getAmount();
            if (outcome == Outcome.RECORDED || outcome == Outcome.RECORDED_AND_MARKED_PAID) report.newlyRecorded++;
            if (outcome == Outcome.RECORDED_AND_MARKED_PAID) report.newlyMarkedPaid++;
            String registrationId = intent.getMetadata().get("registrationId");
            if (registrationId != null && !registrationId.isBlank()) {
                intentsByRegistration.computeIfAbsent(registrationId, k -> new ArrayList<>()).add(intent.getId());
            }
        }
        intentsByRegistration.forEach((reg, ids) -> {
            if (ids.size() > 1) report.chargedMoreThanOnce.put(reg, ids);
        });
        return report;
    }

    // Runs even when the webhook works; it only writes what is missing.
    @Scheduled(initialDelay = 60_000L, fixedDelay = 10 * 60_000L)
    public void safetyNet() {
        if (!stripeService.isEnabled()) return;
        try {
            SyncReport report = sync(Instant.now().minusSeconds(SAFETY_NET_LOOKBACK_SECONDS));
            if (report.newlyRecorded > 0) {
                System.out.println("[TerminalPaymentRecorder] safety net recorded " + report.newlyRecorded
                    + " Tap to Pay payment(s) the webhook missed");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private boolean markRegistrationPaid(String registrationId, PaymentIntent intent) {
        UUID id;
        try {
            id = UUID.fromString(registrationId);
        } catch (IllegalArgumentException e) {
            return false;
        }
        return registrationRepository.findById(id).map(reg -> {
            if (reg.isPaid()) return false;
            reg.setPaid(true);
            reg.setPaidAt(Instant.ofEpochSecond(intent.getCreated()));
            BigDecimal current = reg.getAmountPaid() != null ? reg.getAmountPaid() : BigDecimal.ZERO;
            reg.setAmountPaid(current.add(BigDecimal.valueOf(intent.getAmount(), 2)));
            reg.setPaypalOrderId(intent.getId());
            registrationRepository.save(reg);
            return true;
        }).orElse(false);
    }

    private static Map<String, Object> receiptPayload(PaymentIntent intent) {
        Map<String, Object> payload = new LinkedHashMap<>(Map.of(
            "id", intent.getId(),
            "status", "COMPLETED",
            "payer", Map.of(),
            "purchase_units", List.of(Map.of(
                "amount", Map.of(
                    "value", BigDecimal.valueOf(intent.getAmount(), 2).toPlainString(),
                    "currency_code", intent.getCurrency().toUpperCase()
                )
            ))
        ));
        String itemsJson = intent.getMetadata().get("items");
        if (itemsJson != null && !itemsJson.isBlank()) {
            payload.put("items", JsonUtils.readList(itemsJson));
        }
        return payload;
    }

    public static class SyncReport {
        public int succeeded;
        public long totalCents;
        public int newlyRecorded;
        public int newlyMarkedPaid;
        public Map<String, List<String>> chargedMoreThanOnce = new LinkedHashMap<>();
    }
}
