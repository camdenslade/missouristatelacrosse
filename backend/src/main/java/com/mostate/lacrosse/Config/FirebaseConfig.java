package com.mostate.lacrosse.Config;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void init() {
        try {

            List<FirebaseApp> apps = FirebaseApp.getApps();
            if (apps != null && !apps.isEmpty()) {
                System.out.println("Firebase already initialized.");
                return;
            }

            System.out.println("Attempting to load Firebase credentials from AWS Secrets Manager...");
            Region region = Region.of(System.getenv().getOrDefault("AWS_REGION", "us-east-1"));

            SecretsManagerClient client = SecretsManagerClient.builder()
                    .region(region)
                    .build();

            GetSecretValueRequest request = GetSecretValueRequest.builder()
                    .secretId("firebase-service-account")
                    .build();

            GetSecretValueResponse response = client.getSecretValue(request);
            String firebaseJson = response.secretString();

            if (firebaseJson == null || firebaseJson.isEmpty()) {
                throw new RuntimeException("Firebase secret was empty!");
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(
                            new ByteArrayInputStream(firebaseJson.getBytes(StandardCharsets.UTF_8))
                    ))
                    .build();

            FirebaseApp.initializeApp(options);
            System.out.println("Firebase initialized successfully from AWS Secrets Manager.");

        } catch (Exception e) {
            System.err.println("Failed to initialize Firebase: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
