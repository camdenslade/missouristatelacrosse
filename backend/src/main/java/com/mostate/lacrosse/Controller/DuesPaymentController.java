package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.DuesPayment;
import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.DuesPaymentRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PaymentReceiptService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/dues-payments")
public class DuesPaymentController {

    private static final List<String> ADMIN_ONLY_TYPES = List.of("CHARGE", "CREDIT", "ADJUSTMENT");
    private static final DateTimeFormatter RECEIPT_DATE_FORMAT =
        DateTimeFormatter.ofPattern("MMMM d, yyyy 'at' h:mm a").withZone(ZoneId.of("America/Chicago"));

    private final DuesPaymentRepository repo;
    private final PlayerRepository playerRepo;
    private final PlayerProfileService profileService;
    private final PaymentReceiptService receiptService;
    private final AuthorizationService authorizationService;
    private final UserAccountRepository userAccountRepo;
    private final EmailService emailService;

    public DuesPaymentController(
        DuesPaymentRepository repo,
        PlayerRepository playerRepo,
        PlayerProfileService profileService,
        PaymentReceiptService receiptService,
        AuthorizationService authorizationService,
        UserAccountRepository userAccountRepo,
        EmailService emailService
    ) {
        this.repo = repo;
        this.playerRepo = playerRepo;
        this.profileService = profileService;
        this.receiptService = receiptService;
        this.authorizationService = authorizationService;
        this.userAccountRepo = userAccountRepo;
        this.emailService = emailService;
    }

    @GetMapping
    public ResponseEntity<?> list(
        HttpServletRequest request,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        try {
            Player player = playerRepo.findById(playerId).orElse(null);
            if (player == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
            }
            if (!isAuthorized(request, player, program)) {
                return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
            }
            List<DuesPayment> entries = repo.findByPlayerIdOrderByCreatedAtDesc(playerId);
            return ResponseEntity.ok(entries);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody DuesPaymentRequest body
    ) {
        try {
            Player player = playerRepo.findById(body.playerId()).orElse(null);
            if (player == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
            }

            if (!isAuthorized(request, player, program)) {
                return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
            }

            BigDecimal amount = body.amount();
            if (amount == null || amount.signum() <= 0) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Amount must be positive"));
            }
            String type = body.type() != null ? body.type().toUpperCase() : "PAYMENT";

            if (ADMIN_ONLY_TYPES.contains(type)) {
                String uid = (String) request.getAttribute("firebaseUid");
                FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
                if (!authorizationService.isAdmin(uid, program, token)) {
                    return ResponseEntity.status(403).body(new ErrorResponse("Admin access required for " + type));
                }
            } else {
                // PAYMENT (self-service): must be backed by a real, unconsumed PayPal capture
                // for exactly this amount.
                String orderId = body.payPalOrderId();
                if (orderId == null || orderId.isBlank()) {
                    return ResponseEntity.badRequest().body(new ErrorResponse("A payment reference is required for a payment"));
                }
                if (repo.existsByPayPalOrderId(orderId)) {
                    DuesPayment existing = repo.findByPayPalOrderId(orderId).orElse(null);
                    return ResponseEntity.ok(Map.of(
                        "id", existing != null ? existing.getId() : "",
                        "newBalance", player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO,
                        "alreadyRecorded", true
                    ));
                }
                PaymentReceipt receipt = receiptService.findReceipt(orderId).orElse(null);
                if (receipt == null) {
                    return ResponseEntity.badRequest().body(new ErrorResponse("No matching payment was found for that reference"));
                }
                if (!"COMPLETED".equalsIgnoreCase(receipt.getStatus())) {
                    return ResponseEntity.badRequest().body(new ErrorResponse("Payment was not completed"));
                }
                if (receipt.getAmount() == null || receipt.getAmount().compareTo(amount) != 0) {
                    return ResponseEntity.badRequest().body(new ErrorResponse("Payment amount does not match the recorded payment"));
                }
                if (!"dues".equalsIgnoreCase(receipt.getSource())) {
                    // Prevents replaying a completed donation/raffle/event-signup capture
                    // (same amount, same COMPLETED status) as if it were a dues payment.
                    return ResponseEntity.badRequest().body(new ErrorResponse("Payment was not recorded as a dues payment"));
                }
            }

            DuesPayment entry = new DuesPayment();
            entry.setPlayerId(body.playerId());
            entry.setAmount(amount);
            entry.setType(type);
            entry.setNote(body.note());
            entry.setPaidByUid((String) request.getAttribute("firebaseUid"));
            entry.setPayPalOrderId(body.payPalOrderId());
            repo.save(entry);

            // Update player balance
            BigDecimal current = player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO;
            BigDecimal newBalance = switch (type) {
                // Payments and credits reduce what the player owes
                case "PAYMENT", "CREDIT" -> current.subtract(amount);
                // Charges and explicit adjustments increase what the player owes
                case "CHARGE", "ADJUSTMENT" -> current.add(amount);
                default -> current.subtract(amount);
            };
            player.setBalance(newBalance);
            playerRepo.save(player);

            if ("PAYMENT".equals(type)) {
                // Best-effort — a receipt email failing to send must never roll back or
                // fail a payment that has already been captured and recorded.
                try {
                    sendReceiptEmail(entry, player, program);
                } catch (Exception emailEx) {
                    System.err.println("Failed to send dues receipt email: " + emailEx.getMessage());
                }
            }

            return ResponseEntity.ok(Map.of(
                "id", entry.getId(),
                "newBalance", newBalance
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    private void sendReceiptEmail(DuesPayment entry, Player player, String program) {
        String payerUid = entry.getPaidByUid();
        UserAccount payerAccount = payerUid != null
            ? userAccountRepo.findByFirebaseUid(payerUid).orElse(null)
            : null;
        String recipientEmail = payerAccount != null && payerAccount.getEmail() != null
            ? payerAccount.getEmail()
            : player.getEmail();
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }
        String payerName = payerAccount != null && payerAccount.getDisplayName() != null
            ? payerAccount.getDisplayName()
            : "there";
        String programLabel = "women".equalsIgnoreCase(program) ? "Women's" : "Men's";
        String dateStr = entry.getCreatedAt() != null
            ? RECEIPT_DATE_FORMAT.format(entry.getCreatedAt())
            : RECEIPT_DATE_FORMAT.format(java.time.Instant.now());

        String html = duesReceiptEmail(
            payerName,
            player.getName(),
            programLabel,
            entry.getAmount(),
            dateStr,
            entry.getPayPalOrderId(),
            player.getBalance()
        );
        emailService.sendEmail(
            recipientEmail,
            "Receipt: Missouri State " + programLabel + " Lacrosse Dues Payment",
            html
        );
    }

    private static String duesReceiptEmail(
        String payerName,
        String playerName,
        String program,
        BigDecimal amountPaid,
        String dateStr,
        String payPalOrderId,
        BigDecimal remainingBalance
    ) {
        BigDecimal balance = remainingBalance != null ? remainingBalance : BigDecimal.ZERO;
        String balanceRow = balance.signum() > 0
            ? "<tr><td style=\"padding:6px 0;color:#5E0009;font-weight:bold;\">Remaining Balance</td><td style=\"padding:6px 0;text-align:right;color:#5E0009;font-weight:bold;\">$%s</td></tr>"
                .formatted(balance.setScale(2, java.math.RoundingMode.HALF_UP))
            : "<tr><td style=\"padding:6px 0;color:#1a7f37;font-weight:bold;\">Remaining Balance</td><td style=\"padding:6px 0;text-align:right;color:#1a7f37;font-weight:bold;\">$0.00 &mdash; Paid in full</td></tr>";

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
                    <tr>
                      <td style="background:#5E0009;padding:28px 40px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">MISSOURI STATE %s LACROSSE</h1>
                        <p style="color:#f0d0d3;margin:6px 0 0;font-size:13px;letter-spacing:2px;">PAYMENT RECEIPT</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="font-size:16px;color:#333;margin:0 0 16px;">Hi %s,</p>
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">Thanks for your payment! Here's your receipt.</p>
                        <table width="100%%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#333;border-top:1px solid #eee;border-bottom:1px solid #eee;padding:8px 0;margin:0 0 16px;">
                          <tr><td style="padding:6px 0;color:#777;">Player</td><td style="padding:6px 0;text-align:right;">%s</td></tr>
                          <tr><td style="padding:6px 0;color:#777;">Date</td><td style="padding:6px 0;text-align:right;">%s</td></tr>
                          <tr><td style="padding:6px 0;color:#777;">Payment Reference</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px;">%s</td></tr>
                          <tr><td style="padding:10px 0 6px;color:#333;font-weight:bold;border-top:1px solid #eee;">Amount Paid</td><td style="padding:10px 0 6px;text-align:right;font-weight:bold;border-top:1px solid #eee;">$%s</td></tr>
                          %s
                        </table>
                        <p style="font-size:12px;color:#999;margin:24px 0 0;">Keep this email as your receipt for this transaction. If anything looks wrong, reply to this email or contact your program admin.</p>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! &mdash; Missouri State %s Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(
                program.toUpperCase(),
                payerName,
                playerName != null ? playerName : "—",
                dateStr,
                payPalOrderId != null ? payPalOrderId : "—",
                amountPaid.setScale(2, java.math.RoundingMode.HALF_UP),
                balanceRow,
                program
            );
    }

    private boolean isAuthorized(HttpServletRequest request, Player player, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        if (uid == null || uid.isBlank()) {
            return false;
        }
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (authorizationService.isAdmin(uid, program, token)) {
            return true;
        }
        if (profileService.isSelf(player, uid)) {
            return true;
        }
        return profileService.isLinkedParent(player, uid);
    }

    public record DuesPaymentRequest(
        UUID playerId,
        BigDecimal amount,
        String type,
        String note,
        String paidByUid,
        String payPalOrderId
    ) {}
}
