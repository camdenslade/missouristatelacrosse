package com.mostate.lacrosse.Config;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import org.springframework.context.annotation.Configuration;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Configuration
public class FirebaseConfig {

    private static final String SECRET_NAME = "lacrosse/firebase-service-account";

    @PostConstruct
    public void init() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {

                SecretsManagerClient client = SecretsManagerClient.create();

                GetSecretValueRequest request = GetSecretValueRequest.builder()
                        .secretId(SECRET_NAME)
                        .build();

                GetSecretValueResponse response = client.getSecretValue(request);
                String secretJson = response.secretString();

                if (secretJson == null || secretJson.isEmpty()) {
                    System.err.println("Firebase secret not found or empty!");
                    return;
                }

                // ===== Initialize Firebase from JSON secret =====
                InputStream serviceAccount = new ByteArrayInputStream(secretJson.getBytes());

                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();

                FirebaseApp.initializeApp(options);
                System.out.println("Firebase initialized successfully (via AWS Secrets Manager)");
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Firebase initialization failed: " + e.getMessage());
        }
    }
}
