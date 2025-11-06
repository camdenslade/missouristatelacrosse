package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Service.EmailService;

@RestController
@RequestMapping("/admin")
@CrossOrigin
public class EmailController {

    private final EmailService emailService;

    public EmailController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping("/send-email/group")
    public ResponseEntity<String> sendGroupEmail(@RequestBody EmailRequest req) {
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
        return ResponseEntity.ok(result);
    }

    @PostMapping("/email/sponsor")
    public ResponseEntity<String> handleSponsor(@RequestBody Map<String, String> body) {
        String business = body.get("businessName");
        String email = body.get("email");
        String phone = body.get("phone");
        String request = body.get("request");
        if ((email == null || email.isBlank()) && (phone == null || phone.isBlank()))
            return ResponseEntity.badRequest().body("At least one contact method required.");
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
                request != null ? request : "N/A");
        emailService.sendEmail("17bcole@gmail.com", "New Sponsor Inquiry", adminBody);
        if (email != null && !email.isBlank()) {
            String thankYou = """
                    Hi %s,

                    Thank you for your interest in supporting Missouri State Lacrosse!
                    We’ve received your inquiry and will reach out soon.

                    Go Bears!
                    – Missouri State Lacrosse
                    """.formatted(business != null ? business : "there");
            emailService.sendEmail(email, "Thank You for Your Sponsorship Inquiry", thankYou);
        }
        return ResponseEntity.ok("Sponsor inquiry processed successfully.");
    }

    @PostMapping("/email/receipt")
    public ResponseEntity<String> sendReceipt(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String name = body.get("name");
        String orderId = body.get("orderId");
        String amount = body.get("amount");
        String message = """
                Hi %s,

                Thank you for your purchase! Your order #%s totaling $%s has been received.

                Go Bears!
                – Missouri State Lacrosse Store
                """.formatted(name != null ? name : "there", orderId, amount);
        emailService.sendEmail(email, "Order Receipt – Missouri State Lacrosse", message);
        return ResponseEntity.ok("Receipt sent.");
    }

    @PostMapping("/email/donation")
    public ResponseEntity<String> sendDonationThankYou(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String name = body.get("name");
        String amount = body.get("amount");
        String message = """
                Hi %s,

                Thank you for your generous donation of $%s to Missouri State Lacrosse!
                Your support helps our athletes and community thrive.

                Go Bears!
                – Missouri State Lacrosse
                """.formatted(name != null ? name : "there", amount);
        emailService.sendEmail(email, "Thank You for Your Donation", message);
        return ResponseEntity.ok("Donation thank-you sent.");
    }

    @PostMapping("/email/account-approved")
    public ResponseEntity<String> sendAccountApproval(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String name = body.get("name");
        String link = body.get("link");
        String message = """
                Hi %s,

                Your Missouri State Lacrosse account request has been approved.
                Please set your password here:

                %s

                Go Bears!
                – Missouri State Lacrosse
                """.formatted(name != null ? name : "there", link);
        emailService.sendEmail(email, "Account Approved – Set Your Password", message);
        return ResponseEntity.ok("Account approval email sent.");
    }

    public static class EmailRequest {
        private List<String> recipients;
        private String subject;
        private String body;
        public List<String> getRecipients() { return recipients; }
        public void setRecipients(List<String> recipients) { this.recipients = recipients; }
        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }
        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }
    }
}
