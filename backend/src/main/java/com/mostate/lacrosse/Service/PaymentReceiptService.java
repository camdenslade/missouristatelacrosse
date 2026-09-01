package com.mostate.lacrosse.Service;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Utils.JsonUtils;

@Service
public class PaymentReceiptService {
    private final PaymentReceiptRepository receiptRepository;

    public PaymentReceiptService(
        PaymentReceiptRepository receiptRepository
    ) {
        this.receiptRepository = receiptRepository;
    }

    /**
     * Records the intended source of a PayPal order at CREATE time, before capture —
     * so capture-time can't be spoofed with a client-supplied source. If a receipt for
     * this orderId already exists (shouldn't normally happen pre-capture), its source is
     * left untouched rather than overwritten.
     */
    public PaymentReceipt reserveSource(String orderId, String source) {
        return reserveSource(orderId, source, "paypal");
    }

    /**
     * Same as {@link #reserveSource(String, String)} but also stamps which processor
     * this order belongs to, so the placeholder row is attributable before capture.
     */
    public PaymentReceipt reserveSource(String orderId, String source, String provider) {
        if (orderId == null || orderId.isBlank() || source == null || source.isBlank()) {
            return null;
        }
        PaymentReceipt receipt = receiptRepository.findByOrderId(orderId).orElseGet(PaymentReceipt::new);
        if (receipt.getOrderId() == null) {
            receipt.setOrderId(orderId);
            receipt.setSource(source);
            receipt.setStatus("CREATED");
            if (provider != null && !provider.isBlank()) {
                receipt.setProvider(provider);
            }
        }
        return receiptRepository.save(receipt);
    }

    /**
     * Only ever returns a payload for a genuinely CAPTURED order. reserveSource() inserts a
     * placeholder receipt at order-CREATE time (status "CREATED", payload defaulting to the
     * column's "{}" default) purely to lock in the source before payment — that row is not
     * blank as a string, so a naive "is the payload non-blank" check treats it as an
     * already-cached capture and short-circuits captureOrder() into returning "{}" without
     * ever calling PayPal, silently no-op'ing the very first capture attempt on every order.
     * Excluding "CREATED" (and any literal empty-object payload as a second guard) is what
     * this method's own doc/callers already assume — it's meant to read back a completed
     * capture, not a pre-payment reservation.
     */
    public Optional<Map<String, Object>> findStoredPayload(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return Optional.empty();
        }
        return receiptRepository.findByOrderId(orderId)
            .filter(r -> r.getStatus() != null && !"CREATED".equalsIgnoreCase(r.getStatus()))
            .map(PaymentReceipt::getPayload)
            .filter(payload -> payload != null && !payload.isBlank() && !"{}".equals(payload.trim()))
            .map(JsonUtils::readMap);
    }

    public BigDecimal sumBySource(String source) {
        return receiptRepository.sumAmountBySource(source);
    }

    public Optional<PaymentReceipt> findReceipt(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return Optional.empty();
        }
        return receiptRepository.findByOrderId(orderId);
    }

    public PaymentReceipt recordPayPalReceipt(Map<String, Object> payload) {
        return recordPayPalReceipt(payload, null);
    }

    /**
     * Provider-neutral entry point. {@code payload} must be shaped like a PayPal
     * capture response (id, status, payer.email_address, purchase_units[0].amount);
     * the Stripe path adapts its Checkout Session into that shape so every downstream
     * verifier (dues, raffle, event, store) stays processor-agnostic.
     */
    public PaymentReceipt recordReceipt(Map<String, Object> payload, String source, String provider) {
        PaymentReceipt receipt = recordPayPalReceipt(payload, source);
        if (provider != null && !provider.isBlank() && !provider.equals(receipt.getProvider())) {
            receipt.setProvider(provider);
            return receiptRepository.save(receipt);
        }
        return receipt;
    }

    public PaymentReceipt recordPayPalReceipt(Map<String, Object> payload, String source) {
        String orderId = readString(payload.get("id"));
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("Payment payload missing order id");
        }

        PaymentReceipt receipt = receiptRepository.findByOrderId(orderId)
            .orElseGet(PaymentReceipt::new);

        receipt.setOrderId(orderId);
        receipt.setStatus(readString(payload.get("status")));
        receipt.setPayload(JsonUtils.toJson(payload));
        if (source != null && !source.isBlank()) {
            receipt.setSource(source);
        }

        Map<String, Object> payer = asMap(payload.get("payer"));
        String email = trimToNull(readString(payer.get("email_address")));
        receipt.setPayerEmail(email);
        receipt.setPayerName(buildPayerName(payer));

        AmountInfo amountInfo = extractAmount(payload);
        if (amountInfo != null) {
            receipt.setAmount(amountInfo.amount());
            receipt.setCurrency(amountInfo.currency());
        }

        return receiptRepository.save(receipt);
    }

    private static String buildPayerName(Map<String, Object> payer) {
        Map<String, Object> name = asMap(payer.get("name"));
        String first = trimToNull(readString(name.get("given_name")));
        String last = trimToNull(readString(name.get("surname")));
        if (first == null && last == null) {
            return null;
        }
        if (first == null) {
            return last;
        }
        if (last == null) {
            return first;
        }
        return (first + " " + last).trim();
    }

    private static AmountInfo extractAmount(Map<String, Object> payload) {
        List<Object> purchaseUnits = asList(payload.get("purchase_units"));
        if (!purchaseUnits.isEmpty()) {
            Map<String, Object> unit = asMap(purchaseUnits.get(0));
            AmountInfo amount = readAmount(asMap(unit.get("amount")));
            if (amount != null) {
                return amount;
            }

            Map<String, Object> payments = asMap(unit.get("payments"));
            List<Object> captures = asList(payments.get("captures"));
            if (!captures.isEmpty()) {
                Map<String, Object> capture = asMap(captures.get(0));
                amount = readAmount(asMap(capture.get("amount")));
                if (amount != null) {
                    return amount;
                }
            }
        }
        return null;
    }

    private static AmountInfo readAmount(Map<String, Object> amountMap) {
        String value = trimToNull(readString(amountMap.get("value")));
        if (value == null) {
            return null;
        }
        try {
            BigDecimal amount = new BigDecimal(value);
            String currency = trimToNull(readString(amountMap.get("currency_code")));
            return new AmountInfo(amount, currency);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String readString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> asList(Object value) {
        if (value instanceof List<?> list) {
            return (List<Object>) list;
        }
        return Collections.emptyList();
    }

    private record AmountInfo(BigDecimal amount, String currency) {}
}
