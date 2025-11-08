package com.mostate.lacrosse.Service;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.google.firebase.auth.ActionCodeSettings;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.google.firebase.cloud.FirestoreClient;
import com.mostate.lacrosse.Repository.AccountRequestRepo;
import com.mostate.lacrosse.Model.AccountRequestModel;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Arrays;


@Service
public class AccountRequestService {

    private final AccountRequestRepo repository;
    private final EmailService emailService;

    public AccountRequestService(AccountRequestRepo repository, EmailService emailService) {
        this.repository = repository;
        this.emailService = emailService;
    }

    public String createRequest(AccountRequestModel requestModel) {
        try {
            if (requestModel.getProgram() == null || requestModel.getProgram().isEmpty()) {
                requestModel.setProgram("men");
            }
            requestModel.setStatus("pending");
            return repository.save(requestModel);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create account request", e);
        }
    }

    public List<AccountRequestModel> getRequests(String program) {
        try {
            return repository.findAll(program);
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch account requests", e);
        }
    }

    public void rejectRequest(String id, String program) {
        try {
            repository.delete(id);
            System.out.println("❌ [" + program + "] Request rejected and deleted: " + id);
        } catch (Exception e) {
            throw new RuntimeException("Failed to reject account request", e);
        }
    }

    public void approveRequest(String id, String program) {
        try {
            AccountRequestModel req = repository.findById(id);
            if (req == null)
                throw new IllegalArgumentException("Request not found: " + id);
            if (!"pending".equalsIgnoreCase(req.getStatus()))
                throw new IllegalStateException("Request is not pending");

            String effectiveProgram = (program != null && !program.isEmpty())
                    ? program.toLowerCase()
                    : (req.getProgram() != null ? req.getProgram().toLowerCase() : "men");

            Firestore db = FirestoreClient.getFirestore();

            UserRecord userRecord;
            try {
                userRecord = FirebaseAuth.getInstance().createUser(
                        new UserRecord.CreateRequest()
                                .setEmail(req.getEmail())
                                .setDisplayName(req.getDisplayName())
                );
                System.out.println("New User created: " + userRecord.getUid());
            } catch (FirebaseAuthException e) {
                if ("EMAIL_EXISTS".equals(e.getErrorCode())) {
                    System.out.println("User already exists, reusing existing account");
                    userRecord = FirebaseAuth.getInstance().getUserByEmail(req.getEmail());
                } else {
                    throw e;
                }
            }

            String resetLink = "";
            try {
                resetLink = FirebaseAuth.getInstance().generatePasswordResetLink(
                        req.getEmail(),
                        ActionCodeSettings.builder()
                                .setUrl("https://missouristatelacrosse.com/")
                                .setHandleCodeInApp(true)
                                .build()
                );
                System.out.println("Password link generated.");
            } catch (Exception linkEx) {
                System.err.println("Failed to generate password link: " + linkEx.getMessage());
            }

            try {
                if (!resetLink.isEmpty()) {
                    String subject = "Your Missouri State Lacrosse Account Has Been Approved";
                    String body = "Hello " + req.getDisplayName() + ",\n\n"
                            + "Your account for the " + capitalize(effectiveProgram) + " program has been approved.\n\n"
                            + "Click below to set your password:\n" + resetLink
                            + "\n\nWelcome to the team!\n\n— Missouri State Lacrosse";
                    emailService.sendEmail(req.getEmail(), subject, body);
                }
            } catch (Exception mailEx) {
                System.err.println("Email sending failed: " + mailEx.getMessage());
            }

            String collection = effectiveProgram.equals("women") ? "playersw" : "players";
            String playerId = null;
            String currentSeason = LocalDate.now().getMonthValue() >= 7
                    ? (LocalDate.now().getYear() % 100) + "-" + ((LocalDate.now().getYear() + 1) % 100)
                    : ((LocalDate.now().getYear() - 1) % 100) + "-" + (LocalDate.now().getYear() % 100);


            ApiFuture<QuerySnapshot> playerQuery = db.collection(collection)
                    .whereEqualTo("name", req.getDisplayName())
                     .whereEqualTo("season", currentSeason)
                    .get();

            List<QueryDocumentSnapshot> playerDocs = playerQuery.get().getDocuments();
            if (!playerDocs.isEmpty()) {
                playerId = playerDocs.get(0).getId();
                db.collection(collection).document(playerId).update("userId", userRecord.getUid());
            } else {
                Map<String, Object> newPlayer = new HashMap<>();
                newPlayer.put("name", req.getDisplayName());
                newPlayer.put("email", req.getEmail());
                newPlayer.put("season", "25-26");
                newPlayer.put("createdAt", FieldValue.serverTimestamp());
                newPlayer.put("userId", userRecord.getUid());

                DocumentReference newPlayerRef = db.collection(collection).document();
                newPlayerRef.set(newPlayer);
                playerId = newPlayerRef.getId();

                System.out.println("Added new player to " + collection + " collection: " + req.getDisplayName());
            }

            Map<String, Object> roles = new HashMap<>();
            roles.put(effectiveProgram, "player");

            Map<String, Object> userData = new HashMap<>();
            userData.put("displayName", req.getDisplayName());
            userData.put("email", req.getEmail());
            userData.put("roles", roles);
            userData.put("programs", Arrays.asList(effectiveProgram));
            if (playerId != null) userData.put("playerId", playerId);

            DocumentReference userDoc = db.collection("users").document(userRecord.getUid());
            userDoc.set(userData).get();

            userDoc.update("role", FieldValue.delete());

            repository.delete(id);

            System.out.println("[" + effectiveProgram + "] Request approved, "
                    + "user created (" + (playerId != null ? "linked to player " + playerId : "general user") + ").");


                    } catch (Exception e) {
                        e.printStackTrace();
                        throw new RuntimeException("Failed to approve account request", e);
                    }
                }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
    }
}
