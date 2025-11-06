package com.mostate.lacrosse.Config;

import java.io.InputStream;
import org.springframework.context.annotation.Configuration;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void init() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                InputStream serviceAccount =
                        getClass().getResourceAsStream("/serviceAccountKey.json");

                if (serviceAccount == null) {
                    System.err.println("serviceAccountKey.json not found in resources folder!");
                    return;
                }

                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();

                FirebaseApp.initializeApp(options);
                System.out.println("Firebase initialized successfully (classpath resource)");
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Firebase initialization failed: " + e.getMessage());
        }
    }
}
