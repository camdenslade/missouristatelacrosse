package com.mostate.lacrosse.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.*;

@Service
public class EmailService{

    private final SesClient sesClient;
    private final String fromAddress;
    private final boolean emailEnabled;

    public EmailService(
            @Value("${aws.accessKeyId:}") String accessKey,
            @Value("${aws.secretKey:}") String secretKey,
            @Value("${aws.region:us-east-2}") String region,
            @Value("${email.fromAddress:no-reply@missouristatelacrosse.com}") String fromAddress,
            @Value("${app.email.enabled:true}") boolean emailEnabled
    ) {
        this.emailEnabled = emailEnabled
                && accessKey != null && !accessKey.isEmpty()
                && secretKey != null && !secretKey.isEmpty();

        this.fromAddress = fromAddress;

        if (this.emailEnabled){
            AwsBasicCredentials creds = AwsBasicCredentials.create(accessKey, secretKey);
            this.sesClient = SesClient.builder()
                    .credentialsProvider(StaticCredentialsProvider.create(creds))
                    .region(Region.of(region))
                    .build();
        } else{
            this.sesClient = null;
        }
    }

    public void sendEmail(String to, String subject, String body) {
        if (!emailEnabled){
            System.out.println("Email sending disabled or SES not configured.");
            return;
        }

        try{
            SendEmailRequest request = SendEmailRequest.builder()
                    .destination(Destination.builder().toAddresses(to).build())
                    .message(Message.builder()
                            .subject(Content.builder().data(subject).build())
                            .body(Body.builder()
                                    .html(Content.builder().data(body).build())
                                    .text(Content.builder()
                                            .data("Your email client does not support HTML.").build())
                                    .build())
                            .build())
                    .source(fromAddress)
                    .build();

            SendEmailResponse response = sesClient.sendEmail(request);
            System.out.println("Email sent to " + to +
                    " [Message ID: " + response.messageId() + "]");
        } catch (Exception ex){
            System.err.println("Failed to send email to " + to + ": " + ex.getMessage());
            ex.printStackTrace();
        }
    }
}
