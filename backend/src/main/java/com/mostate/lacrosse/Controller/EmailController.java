package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PaymentConfirmationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/email")
@CrossOrigin
@Validated
public class EmailController {

    private final EmailService emailService;
    private final AuthorizationService authorizationService;
    private final PaymentConfirmationService confirmations;

    public EmailController(
        EmailService emailService,
        AuthorizationService authorizationService,
        PaymentConfirmationService confirmations
    ) {
        this.emailService = emailService;
        this.authorizationService = authorizationService;
        this.confirmations = confirmations;
    }

    /** Escapes user-supplied text for an HTML email and keeps its line breaks. */
    private static String htmlText(String text) {
        if (text == null || text.isBlank()) {
            return "N/A";
        }
        return text.lines().map(HtmlUtils::htmlEscape).collect(Collectors.joining("<br>"));
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    // Admin bulk-send tool (EmailCenter.tsx) — arbitrary recipients/subject/body, must be admin-only.
    @PostMapping("/group")
    public ResponseEntity<?> sendGroupEmail(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody EmailRequest req
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        int success = 0;
        int failures = 0;
        for (String to : req.getRecipients()) {
            try {
                emailService.sendEmail(to, req.getSubject(), req.getBody());
                success++;
            } catch (Exception e) {
                failures++;
            }
        }
        String result = "Sent to " + success + " recipients";
        if (failures > 0) result += " (" + failures + " failed)";
        return ResponseEntity.ok(new EmailStatusResponse(result));
    }

    @PostMapping("/sponsor")
    public ResponseEntity<?> handleSponsor(@Valid @RequestBody SponsorEmailRequest body) {
        String business = body.businessName();
        String email = body.email();
        String phone = body.phone();
        String request = body.request();
        String program = body.program() != null ? body.program().toLowerCase() : "men";

        if ((email == null || email.isBlank()) && (phone == null || phone.isBlank())) {
            return ResponseEntity.badRequest().body(new ErrorResponse("At least one contact method required."));
        }

        String adminBody = "<p><strong>New Sponsorship Inquiry</strong></p>"
            + "<p>Business: " + htmlText(business) + "<br>"
            + "Email: " + htmlText(email) + "<br>"
            + "Phone: " + htmlText(phone) + "</p>"
            + "<p>Message:<br>" + htmlText(request) + "</p>";

        String adminRecipient = program.equals("women")
                ? "mostatewomenslax@gmail.com"
                : "bcole@missouristatelacrosse.com";

        emailService.sendEmail(adminRecipient, "New Sponsor Inquiry", adminBody);

        if (email != null && !email.isBlank()) {
            // Fixed wording only: nothing the submitter typed is echoed back, so this cannot be
            // used to put someone else's text in an email from our domain.
            String label = program.equals("women") ? "Women's" : "Men's";
            String thankYou = "<p>Hello,</p>"
                + "<p>Thank you for your interest in supporting Missouri State " + label + " Lacrosse! "
                + "We have received your inquiry and will reach out soon.</p>"
                + "<p>Go Bears!<br>Missouri State " + label + " Lacrosse</p>";
            emailService.sendEmail(email, "Thank You for Your Sponsorship Inquiry", thankYou);
        }

        return ResponseEntity.ok(new EmailStatusResponse("Sponsor inquiry processed successfully."));
    }

    /**
     * Sent by the payment success pages after a completed payment. The caller names the payment
     * and the wording ("order", "donation" or "fundraiser"); the recipient, name and amount come
     * from the stored payment record, and each order is mailed at most once. This replaces the old
     * /send and /receipt endpoints, which mailed any address with any subject and HTML body.
     */
    @PostMapping("/payment-confirmation")
    public ResponseEntity<?> paymentConfirmation(@Valid @RequestBody PaymentConfirmationRequest body) {
        PaymentConfirmationService.Kind kind;
        try {
            kind = PaymentConfirmationService.Kind.valueOf(body.kind().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Unknown confirmation type."));
        }
        return switch (confirmations.send(body.orderId(), kind)) {
            case SENT -> ResponseEntity.ok(new EmailStatusResponse("Confirmation sent."));
            case ALREADY_SENT -> ResponseEntity.ok(new EmailStatusResponse("Confirmation already sent."));
            case NOT_FOUND -> ResponseEntity.status(404).body(new ErrorResponse("No such payment."));
            case NOT_COMPLETED -> ResponseEntity.status(409).body(new ErrorResponse("Payment is not complete."));
            case NO_EMAIL -> ResponseEntity.unprocessableEntity().body(new ErrorResponse("No email on file for this payment."));
            case FAILED -> ResponseEntity.status(502).body(new ErrorResponse("Could not send the confirmation."));
        };
    }

    // Not called by any current frontend flow — gated admin-only rather than left open,
    // since an arbitrary-recipient "thank you for your donation" send is a phishing/spam
    // relay risk with no legitimate anonymous use case.
    @PostMapping("/donation")
    public ResponseEntity<?> sendDonationThankYou(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody DonationRequest body
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        String email = body.email();
        String name = body.name();
        String amount = body.amount();
        String message = """
                Hi %s,

                Thank you for your generous donation of $%s to Missouri State Lacrosse!
                Your support helps our athletes and community thrive.

                Questions about this donation? billing@missouristatelacrosse.com

                Go Bears!
                - Missouri State Lacrosse
                """.formatted(name != null ? name : "there", amount);
        emailService.sendEmail(email, "Thank You for Your Donation", message);
        return ResponseEntity.ok(new EmailStatusResponse("Donation thank-you sent."));
    }

    // Not called by any current frontend flow — AccountRequestService already sends its
    // own approval email inline. Gated admin-only: the caller-supplied "link" field is
    // otherwise a direct phishing vector (arbitrary link, official branding, any recipient).
    @PostMapping("/account-approved")
    public ResponseEntity<?> sendAccountApproval(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody AccountApprovalRequest body
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        String email = body.email();
        String name = body.name();
        String link = body.link();
        String message = """
                Hi %s,

                Your Missouri State Lacrosse account request has been approved.
                Please set your password here:

                %s

                Go Bears!
                - Missouri State Lacrosse
                """.formatted(name != null ? name : "there", link);
        emailService.sendEmail(email, "Account Approved - Set Your Password", message);
        return ResponseEntity.ok(new EmailStatusResponse("Account approval email sent."));
    }

    public static class EmailRequest {
        @NotEmpty
        private List<@Email String> recipients;
        @NotBlank
        private String subject;
        @NotBlank
        private String body;
        public List<String> getRecipients() { return recipients; }
        public void setRecipients(List<String> recipients) { this.recipients = recipients; }
        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }
        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }
    }

    public record SponsorEmailRequest(
        @NotBlank @Size(max = 120) String businessName,
        @Email @Size(max = 200) String email,
        @Size(max = 40) String phone,
        @NotBlank @Size(max = 2000) String request,
        @Size(max = 10) String program
    ) {}

    public record PaymentConfirmationRequest(
        @NotBlank @Size(max = 80) String orderId,
        @NotBlank @Size(max = 20) String kind
    ) {}

    public record DonationRequest(
        @Email String email,
        String name,
        @NotBlank String amount
    ) {}

    public record AccountApprovalRequest(
        @Email String email,
        String name,
        @NotBlank String link
    ) {}

    public record EmailStatusResponse(String message) {}
}
