package com.mostate.lacrosse.Controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Service.EmailService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

@RestController
@RequestMapping("/api/email")
@CrossOrigin
@Validated
public class EmailController {

    private final EmailService emailService;

    public EmailController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping("/group")
    public ResponseEntity<EmailStatusResponse> sendGroupEmail(@Valid @RequestBody EmailRequest req) {
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

        String adminBody = """
            New Sponsorship Inquiry

            Business: %s
            Email: %s
            Phone: %s

            Message:
            %s
            """.formatted(
            business != null ? business : "N/A",
            email != null && !email.isBlank() ? email : "N/A",
            phone != null && !phone.isBlank() ? phone : "N/A",
            request != null ? request : "N/A"
        );

        String adminRecipient = program.equals("women")
                ? "mostatewomenslax@gmail.com"
                : "17bcole@gmail.com";

        emailService.sendEmail(adminRecipient, "New Sponsor Inquiry", adminBody);

        if (email != null && !email.isBlank()) {
            String thankYou = """
                    Hello %s,

                    Thank you for your interest in supporting Missouri State %s Lacrosse!
                    We've received your inquiry and will reach out soon.

                    Go Bears!
                    - Missouri State %s Lacrosse
                    """.formatted(
                    business != null ? business : "there",
                    program.equals("women") ? "Women's" : "Men's",
                    program.equals("women") ? "Women's" : "Men's"
            );
            emailService.sendEmail(email, "Thank You for Your Sponsorship Inquiry", thankYou);
        }

        return ResponseEntity.ok(new EmailStatusResponse("Sponsor inquiry processed successfully."));
    }

    @PostMapping("/receipt")
    public ResponseEntity<EmailStatusResponse> sendReceipt(@Valid @RequestBody ReceiptRequest body) {
        String email = body.email();
        String name = body.name();
        String message = """
            Hi %s,

            %s

            Go Bears!
            - Missouri State Lacrosse Store
            """.formatted(
                name != null ? name : "there",
                body.body()
            );
        emailService.sendEmail(email, "Order Receipt - Missouri State Lacrosse", message);
        return ResponseEntity.ok(new EmailStatusResponse("Receipt sent."));
    }

    @PostMapping("/donation")
    public ResponseEntity<EmailStatusResponse> sendDonationThankYou(@Valid @RequestBody DonationRequest body) {
        String email = body.email();
        String name = body.name();
        String amount = body.amount();
        String message = """
                Hi %s,

                Thank you for your generous donation of $%s to Missouri State Lacrosse!
                Your support helps our athletes and community thrive.

                Go Bears!
                - Missouri State Lacrosse
                """.formatted(name != null ? name : "there", amount);
        emailService.sendEmail(email, "Thank You for Your Donation", message);
        return ResponseEntity.ok(new EmailStatusResponse("Donation thank-you sent."));
    }

    @PostMapping("/account-approved")
    public ResponseEntity<EmailStatusResponse> sendAccountApproval(@Valid @RequestBody AccountApprovalRequest body) {
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
        @NotBlank String businessName,
        @Email String email,
        String phone,
        @NotBlank String request,
        String program
    ) {}

    public record ReceiptRequest(
        @Email String email,
        String name,
        @NotBlank String orderId,
        @NotBlank String body
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
