package com.mostate.lacrosse.Service;

import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Sends the "thank you / receipt" email for a completed payment.
 *
 * The recipient, name and amount always come from the stored payment record (written by the
 * server when the payment was captured), never from the caller. The caller can only say which
 * payment and which wording, so this cannot be used to send arbitrary mail, and an order gets
 * at most one confirmation however many times it is requested.
 */
@Service
public class PaymentConfirmationService {

    public enum Kind { ORDER, DONATION, FUNDRAISER }

    public enum Result { SENT, ALREADY_SENT, NOT_FOUND, NOT_COMPLETED, NO_EMAIL, FAILED }

    private static final Logger log = LoggerFactory.getLogger(PaymentConfirmationService.class);

    private final PaymentReceiptRepository receipts;
    private final EmailService emailService;

    public PaymentConfirmationService(PaymentReceiptRepository receipts, EmailService emailService) {
        this.receipts = receipts;
        this.emailService = emailService;
    }

    public Result send(String orderId, Kind kind) {
        Optional<PaymentReceipt> found = orderId == null || orderId.isBlank()
            ? Optional.empty()
            : receipts.findByOrderId(orderId.trim());
        if (found.isEmpty()) {
            return Result.NOT_FOUND;
        }
        PaymentReceipt receipt = found.get();
        if (!"COMPLETED".equalsIgnoreCase(receipt.getStatus())) {
            return Result.NOT_COMPLETED;
        }
        String to = receipt.getPayerEmail();
        if (to == null || to.isBlank()) {
            return Result.NO_EMAIL;
        }
        if (receipt.getReceiptSentAt() != null) {
            return Result.ALREADY_SENT;
        }
        // Claim the send in the database first so two simultaneous requests cannot both mail it.
        if (receipts.claimReceiptSend(receipt.getOrderId()) == 0) {
            return Result.ALREADY_SENT;
        }
        boolean sent = false;
        try {
            sent = emailService.sendEmail(to, subject(kind), body(kind, receipt));
        } catch (RuntimeException e) {
            log.error("Confirmation email for order {} failed: {}", receipt.getOrderId(), e.getMessage());
        }
        if (!sent) {
            receipts.releaseReceiptSend(receipt.getOrderId());
            return Result.FAILED;
        }
        return Result.SENT;
    }

    static String subject(Kind kind) {
        return switch (kind) {
            case ORDER -> "Order Receipt - Missouri State Lacrosse";
            case DONATION -> "Thank You for Supporting Missouri State Lacrosse";
            case FUNDRAISER -> "Thank You for Supporting Missouri State Lacrosse";
        };
    }

    static String body(Kind kind, PaymentReceipt receipt) {
        String name = receipt.getPayerName() == null || receipt.getPayerName().isBlank()
            ? "there"
            : HtmlUtils.htmlEscape(receipt.getPayerName());
        String amount = amountText(receipt.getAmount());
        String orderId = HtmlUtils.htmlEscape(receipt.getOrderId());

        String lead;
        String detail;
        switch (kind) {
            case ORDER -> {
                lead = "Thank you for your order from Missouri State Lacrosse!";
                detail = "Your order ID is <strong>" + orderId + "</strong>" + (amount.isEmpty() ? "." : " and the total was " + amount + ".");
            }
            case FUNDRAISER -> {
                lead = "Thank you for your generous donation" + (amount.isEmpty() ? "" : " of " + amount) + "!";
                detail = "Your support makes a real difference for our athletes. We are a non-scholarship organization "
                    + "supported by player dues and fundraising. All donations are tax deductible: Missouri State Lacrosse "
                    + "is a registered 501(c)(3) organization.";
            }
            default -> {
                lead = "Thank you for your generous donation" + (amount.isEmpty() ? "" : " of " + amount) + " to Missouri State Lacrosse.";
                detail = "Your support helps our athletes, staff, and program grow stronger every day.";
            }
        }
        String footer = "Questions? Write to billing@missouristatelacrosse.com. Go Bears!";
        return "<div style=\"font-family:Arial,sans-serif;font-size:15px;color:#333;max-width:560px;\">"
            + "<p>Hi " + name + ",</p>"
            + "<p>" + lead + "</p>"
            + "<p>" + detail + "</p>"
            + "<p style=\"color:#777;font-size:13px;\">" + footer + "</p>"
            + "<p style=\"color:#5E0009;font-weight:bold;\">Missouri State Lacrosse</p>"
            + "</div>";
    }

    private static String amountText(BigDecimal amount) {
        return amount == null ? "" : "$" + amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }
}
