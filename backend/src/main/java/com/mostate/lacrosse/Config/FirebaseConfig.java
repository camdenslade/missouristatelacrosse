package com.mostate.lacrosse.Config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import javax.annotation.PostConstruct;
import java.io.IOException;

@Configuration
public class FirebaseConfig{

    @PostConstruct
    public void init() throws IOException{
        if (FirebaseApp.getApps().isEmpty()){

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(
                            new ClassPathResource("serviceAccountKey.json").getInputStream()
                    ))
                    .setDatabaseUrl("https://missouristatelacrosse-cc913.firebaseio.com")
                    .setStorageBucket("missouristatelacrosse-cc913.firebasestorage.app") // ✅ important line
                    .build();

            FirebaseApp.initializeApp(options);
            System.out.println("Firebase initialized successfully with custom bucket!");
        } else{
            System.out.println("Firebase already initialized — skipping duplicate init.");
        }
    }
}
