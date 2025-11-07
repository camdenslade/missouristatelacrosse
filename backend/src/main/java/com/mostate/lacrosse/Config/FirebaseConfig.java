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
                System.out.println("Firebase already initialized");
                return;
            }

            String firebaseJson = null;

            try {
                Region region = Region.of(System.getenv().getOrDefault("AWS_REGION", "us-east-1"));
                SecretsManagerClient client = SecretsManagerClient.builder()
                        .region(region)
                        .build();

                GetSecretValueRequest request = GetSecretValueRequest.builder()
                        .secretId("firebase-service-account")
                        .build();

                GetSecretValueResponse response = client.getSecretValue(request);
                firebaseJson = response.secretString();

                if (firebaseJson != null && !firebaseJson.isEmpty()) {
                    System.out.println("Firebase credentials loaded from AWS Secrets Manager");
                }

            } catch (Exception e) {
                System.err.println("Could not load Firebase secret from Secrets Manager: " + e.getMessage());
            }

            if (firebaseJson == null || firebaseJson.isEmpty()) {
                firebaseJson = System.getenv("FIREBASE_CREDENTIALS");
                if (firebaseJson != null && !firebaseJson.isEmpty()) {
                    System.out.println("Firebase credentials loaded from FIREBASE_CREDENTIALS env var");
                }
            }
            if (firebaseJson == null || firebaseJson.isEmpty()) {
                System.err.println("No Firebase credentials found. Skipping initialization.");
                return;
            }
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(
                            new ByteArrayInputStream(firebaseJson.getBytes(StandardCharsets.UTF_8))
                    ))
                    .build();

            FirebaseApp.initializeApp(options);
            System.out.println("Firebase initialized successfully!");

        } catch (Exception e) {
            System.err.println("Firebase initialization failed: " + e.getMessage());
        }
    }
}
