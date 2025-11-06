package com.mostate.lacrosse.Controller;

import com.mostate.lacrosse.Service.EmailService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/admin")
public class EmailController {

    private final EmailService emailService;

    public EmailController(EmailService emailService){
        this.emailService = emailService;
    }

    @PostMapping("/send-email/group")
    public ResponseEntity<String> sendGroupEmail(@RequestBody EmailRequest req){
        int success = 0;
        int failures = 0;

        for (String to : req.getRecipients()){
            try{
                emailService.sendEmail(to, req.getSubject(), req.getBody());
                success++;
            } catch (Exception e){
                failures++;
                System.err.println("Failed to send email to " + to + ": " + e.getMessage());
            }
        }

        String result = "Sent to " + success + " recipients";
        if (failures > 0){
            result += " (" + failures + " failed)";
        }

        return ResponseEntity.ok(result);
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
