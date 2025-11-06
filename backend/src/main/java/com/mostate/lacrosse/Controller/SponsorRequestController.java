package com.mostate.lacrosse.Controller;

import com.google.api.core.ApiFuture;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/sponsor-request")
public class SponsorRequestController {

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body){
        try{
            String businessName = String.valueOf(body.getOrDefault("businessName", ""));
            String contactInfo = String.valueOf(body.getOrDefault("contactInfo", ""));
            String request = String.valueOf(body.getOrDefault("request", ""));

            if (businessName.isBlank() || contactInfo.isBlank() || request.isBlank()){
                return ResponseEntity.badRequest().body(Map.of("error", "All fields are required"));
            }

            Firestore fs = FirestoreClient.getFirestore();
            Map<String, Object> doc = new HashMap<>();
            doc.put("businessName", businessName);
            doc.put("contactInfo", contactInfo);
            doc.put("request", request);
            doc.put("createdAt", Timestamp.now());

            DocumentReference ref = fs.collection("sponsorRequests").document();
            doc.put("id", ref.getId());
            ApiFuture<?> write = ref.set(doc);
            write.get();

            return ResponseEntity.ok(Map.of("id", ref.getId()));
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}


