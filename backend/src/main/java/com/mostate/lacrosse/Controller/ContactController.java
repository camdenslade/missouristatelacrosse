package com.mostate.lacrosse.Controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Utils.EmailTemplate;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * The public support/contact page. One shared inbox, not program-specific - the page
 * itself isn't under /men or /women, so there's nothing to split by tenant.
 */
@RestController
@RequestMapping("/api/contact")
public class ContactController {
    private final EmailService emailService;

    @Value("${app.support.email:support@missouristatelacrosse.com}")
    private String supportEmail;

    public ContactController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody ContactRequest body) {
        String name = TextSanitizer.clean(body.name());
        String email = TextSanitizer.clean(body.email());
        String subject = TextSanitizer.clean(body.subject());
        String message = TextSanitizer.clean(body.message());

        if (name == null || name.isBlank() || email == null || email.isBlank()
                || message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Name, email, and a message are required"));
        }

        String body_ = EmailTemplate.paragraph("New message from the support page:")
            + EmailTemplate.paragraph("<b>From:</b> " + name + " (" + email + ")")
            + (subject != null && !subject.isBlank() ? EmailTemplate.paragraph("<b>Subject:</b> " + subject) : "")
            + EmailTemplate.paragraph(message.replace("\n", "<br>"));

        boolean sent = emailService.sendEmail(
            supportEmail,
            "Support request" + (subject != null && !subject.isBlank() ? ": " + subject : ""),
            EmailTemplate.wrap("", body_)
        );

        if (!sent) {
            return ResponseEntity.internalServerError().body(new ErrorResponse("Failed to send - please email us directly"));
        }
        return ResponseEntity.ok().build();
    }

    public record ContactRequest(
        @NotBlank String name,
        @Email String email,
        String subject,
        @NotBlank String message
    ) {}
}
