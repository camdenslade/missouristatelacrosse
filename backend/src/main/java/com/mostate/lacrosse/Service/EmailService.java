package com.mostate.lacrosse.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
import software.amazon.awssdk.services.ses.model.SendEmailResponse;

@Service
public class EmailService {

    private final SesClient sesClient;
    private final String fromAddress;
    private final boolean emailEnabled;

    public EmailService(
                @Value("${AWS_REGION}") String region,
                @Value("${AWS_SES_SENDER}") String fromAddress
        ) {
        this.emailEnabled = true;
        this.fromAddress = fromAddress;
        this.sesClient = SesClient.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        }

    public void sendEmail(String to, String subject, String body) {
        if (!emailEnabled) {
            System.out.println("Email sending disabled or SES not configured.");
            return;
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
            System.out.println("Email sent to " + to +
                    " [Message ID: " + response.messageId() + "]");
        } catch (Exception ex) {
            System.err.println("Failed to send email to " + to + ": " + ex.getMessage());
            ex.printStackTrace();
        }
    }
}
