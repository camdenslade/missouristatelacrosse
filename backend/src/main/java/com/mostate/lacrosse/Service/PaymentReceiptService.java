package com.mostate.lacrosse.Service;

import java.math.BigDecimal;
import java.time.Instant;
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
    private final EmailService emailService;

    public PaymentReceiptService(
        PaymentReceiptRepository receiptRepository,
        EmailService emailService
    ) {
        this.receiptRepository = receiptRepository;
        this.emailService = emailService;
    }

    public Optional<Map<String, Object>> findStoredPayload(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return Optional.empty();
        }
        return receiptRepository.findByOrderId(orderId)
            .map(PaymentReceipt::getPayload)
            .filter(payload -> payload != null && !payload.isBlank())
            .map(JsonUtils::readMap);
    }

    public PaymentReceipt recordPayPalReceipt(Map<String, Object> payload) {
        String orderId = readString(payload.get("id"));
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("PayPal payload missing order id");
        }

        PaymentReceipt receipt = receiptRepository.findByOrderId(orderId)
            .orElseGet(PaymentReceipt::new);

        receipt.setOrderId(orderId);
        receipt.setStatus(readString(payload.get("status")));
        receipt.setPayload(JsonUtils.toJson(payload));

        Map<String, Object> payer = asMap(payload.get("payer"));
        String email = trimToNull(readString(payer.get("email_address")));
        receipt.setPayerEmail(email);
        receipt.setPayerName(buildPayerName(payer));

        AmountInfo amountInfo = extractAmount(payload);
        if (amountInfo != null) {
            receipt.setAmount(amountInfo.amount());
            receipt.setCurrency(amountInfo.currency());
        }

        PaymentReceipt saved = receiptRepository.save(receipt);

        if (saved.getReceiptSentAt() == null && email != null) {
            sendReceiptEmail(
                email,
                saved.getPayerName(),
                saved.getOrderId(),
                saved.getAmount()
            );
            saved.setReceiptSentAt(Instant.now());
            saved = receiptRepository.save(saved);
        }

        return saved;
    }

    private void sendReceiptEmail(
        String email,
        String name,
        String orderId,
        BigDecimal amount
    ) {
        String amountText = amount != null ? amount.toPlainString() : "0.00";
        String message = """
            Hi %s,

            Thank you for your purchase! Your order #%s totaling $%s has been received.

            Go Bears!
            - Missouri State Lacrosse Store
            """.formatted(name != null && !name.isBlank() ? name : "there", orderId, amountText);
        emailService.sendEmail(email, "Order Receipt - Missouri State Lacrosse", message);
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
