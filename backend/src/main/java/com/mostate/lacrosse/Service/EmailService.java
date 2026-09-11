package com.mostate.lacrosse.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.MessageRejectedException;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
import software.amazon.awssdk.services.ses.model.SendEmailResponse;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final SesClient sesClient;
    private final String fromAddress;
    private final boolean emailEnabled;

    public EmailService(
                @Value("${AWS_REGION:us-east-1}") String region,
                @Value("${AWS_SES_SENDER:no-reply@missouristatelacrosse.com}") String fromAddress,
                @Value("${app.email.enabled:true}") boolean emailEnabled
        ) {
        this.emailEnabled = emailEnabled;
        this.fromAddress = fromAddress;
        this.sesClient = SesClient.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        }

    /**
     * Returns true if SES accepted the send, false otherwise (including when email is
     * disabled). Callers that trigger a send as a side effect of something else (account
     * creation, roster edit) must check this rather than assume delivery - previously this
     * method returned void and every failure was invisible outside a grep of stdout/stderr.
     */
    public boolean sendEmail(String to, String subject, String body) {
        if (!emailEnabled) {
            log.info("Email sending disabled (app.email.enabled=false); not sending to {}", to);
            return false;
        }

        try {
            SendEmailRequest request = SendEmailRequest.builder()
                    .destination(Destination.builder().toAddresses(to).build())
                    .message(Message.builder()
                            .subject(Content.builder().data(subject).build())
                            .body(Body.builder()
                                    .html(Content.builder().data(body).build())
                                    .text(Content.builder()
                                            .data("Your email client does not support HTML.")
                                            .build())
                                    .build())
                            .build())
                    .source(fromAddress)
                    .build();

            SendEmailResponse response = sesClient.sendEmail(request);
            log.info("Email sent to {} [Message ID: {}]", to, response.messageId());
            return true;
        } catch (MessageRejectedException ex) {
            // The classic cause: the SES account is still in sandbox mode, which only
            // allows sending to individually-verified addresses/domains until AWS grants
            // production access (Console > SES > Account dashboard > Request production
            // access). Also thrown for a suppressed/bounced/complained recipient.
            log.warn(
                "SES rejected email to {}: {} (if this is unexpected, check whether the SES "
                    + "account is still in sandbox mode)",
                to, ex.getMessage()
            );
            return false;
        } catch (Exception ex) {
            log.error("Failed to send email to {}: {}", to, ex.getMessage(), ex);
            return false;
        }
    }
}
