package com.mostate.lacrosse.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.ActionCodeSettings;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.mostate.lacrosse.Model.AccountRequestModel;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.AccountRequestRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Utils.TextSanitizer;


@Service
public class AccountRequestService {

    private final AccountRequestRepository repository;
    private final EmailService emailService;
    private final UserAccountRepository userRepository;
    private final PlayerRepository playerRepository;
    private final PlayerProfileService profileService;
    private final ObjectMapper mapper = new ObjectMapper();

    public AccountRequestService(
        AccountRequestRepository repository,
        EmailService emailService,
        UserAccountRepository userRepository,
        PlayerRepository playerRepository,
        PlayerProfileService profileService
    ) {
        this.repository = repository;
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.playerRepository = playerRepository;
        this.profileService = profileService;
    }

    public String createRequest(AccountRequestModel requestModel) {
        try {
            requestModel.setDisplayName(TextSanitizer.clean(requestModel.getDisplayName()));
            requestModel.setEmail(TextSanitizer.clean(requestModel.getEmail()));
            requestModel.setProgram(TextSanitizer.clean(requestModel.getProgram()));
            if (requestModel.getProgram() == null || requestModel.getProgram().isEmpty()) {
                requestModel.setProgram("men");
            }
            requestModel.setStatus("pending");
            return repository.save(requestModel).getId().toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create account request", e);
        }
    }

    public List<AccountRequestModel> getRequests(String program) {
        try {
            String sanitizedProgram = TextSanitizer.clean(program);
            if (sanitizedProgram == null || sanitizedProgram.isBlank() || "all".equalsIgnoreCase(sanitizedProgram)) {
                return repository.findAll();
            }
            return repository.findAllByProgramIgnoreCase(sanitizedProgram);
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch account requests", e);
        }
    }

    public void rejectRequest(String id, String program) {
        try {
            UUID requestId = UUID.fromString(id);
            repository.deleteById(requestId);
            System.out.println("❌ [" + program + "] Request rejected and deleted: " + id);
        } catch (Exception e) {
            throw new RuntimeException("Failed to reject account request", e);
        }
    }

    public void approveRequest(String id, String program) {
        try {
            UUID requestId = UUID.fromString(id);
            AccountRequestModel req = repository.findById(requestId)
                .orElse(null);
            if (req == null) {
                throw new IllegalArgumentException("Request not found: " + id);
            }
            if (!"pending".equalsIgnoreCase(req.getStatus()))
                throw new IllegalStateException("Request is not pending");

            String sanitizedProgram = TextSanitizer.clean(program);
            String sanitizedReqProgram = TextSanitizer.clean(req.getProgram());
            String effectiveProgram = (sanitizedProgram != null && !sanitizedProgram.isEmpty())
                    ? sanitizedProgram.toLowerCase()
                    : (sanitizedReqProgram != null ? sanitizedReqProgram.toLowerCase() : "men");
            String displayName = TextSanitizer.clean(req.getDisplayName());
            String email = TextSanitizer.clean(req.getEmail());

            UserRecord userRecord;
            try {
                userRecord = FirebaseAuth.getInstance().createUser(
                        new UserRecord.CreateRequest()
                                .setEmail(email)
                                .setDisplayName(displayName)
                );
                System.out.println("New User created: " + userRecord.getUid());
            } catch (FirebaseAuthException e) {
                if (e.getAuthErrorCode() == AuthErrorCode.EMAIL_ALREADY_EXISTS) {
                    System.out.println("User already exists, reusing existing account");
                    userRecord = FirebaseAuth.getInstance().getUserByEmail(email);
                } else {
                    throw e;
                }
            }

            String resetLink = "";
            try {
                resetLink = FirebaseAuth.getInstance().generatePasswordResetLink(
                        email,
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
                    String body = "Hello " + displayName + ",\n\n"
                            + "Your account for the " + capitalize(effectiveProgram) + " program has been approved.\n\n"
                            + "Click below to set your password:\n" + resetLink
                            + "\n\nWelcome to the team!\n\n— Missouri State Lacrosse";
                    emailService.sendEmail(email, subject, body);
                }
            } catch (Exception mailEx) {
                System.err.println("Email sending failed: " + mailEx.getMessage());
            }

            String currentSeason = LocalDate.now().getMonthValue() >= 7
                    ? (LocalDate.now().getYear() % 100) + "-" + ((LocalDate.now().getYear() + 1) % 100)
                    : ((LocalDate.now().getYear() - 1) % 100) + "-" + (LocalDate.now().getYear() % 100);


            Player player = playerRepository
                .findFirstByNameIgnoreCaseAndSeason(displayName, currentSeason)
                .orElse(null);
            var profile = profileService.findOrCreateByFirebaseUid(
                userRecord.getUid(),
                displayName,
                email
            );
            if (player != null) {
                player.setUserUid(userRecord.getUid());
                if (profile != null) {
                    player.setProfileId(profile.getId());
                }
                playerRepository.save(player);
            } else {
                Player newPlayer = new Player();
                newPlayer.setName(displayName);
                newPlayer.setEmail(email);
                newPlayer.setSeason(currentSeason);
                newPlayer.setUserUid(userRecord.getUid());
                if (profile != null) {
                    newPlayer.setProfileId(profile.getId());
                }
                newPlayer.setBalance(BigDecimal.ZERO);
                playerRepository.save(newPlayer);
            }

            Map<String, Object> roles = new HashMap<>();
            roles.put(effectiveProgram, "player");

            Map<String, Object> userData = new HashMap<>();
            userData.put("displayName", displayName);
            userData.put("email", email);
            userData.put("roles", roles);
            userData.put("programs", Arrays.asList(effectiveProgram));
            if (profile != null) userData.put("playerId", profile.getId().toString());

            UserAccount userAccount = userRepository
                .findByFirebaseUid(userRecord.getUid())
                .orElseGet(UserAccount::new);
            userAccount.setFirebaseUid(userRecord.getUid());
            userAccount.setEmail(email);
            userAccount.setDisplayName(displayName);
            userAccount.setPlayerId(profile != null ? profile.getId() : null);
            userAccount.setRoles(toJson(roles));
            userAccount.setPrograms(toJson(userData.get("programs")));
            userRepository.save(userAccount);

            repository.deleteById(requestId);

            System.out.println("[" + effectiveProgram + "] Request approved, "
                    + "user created (" + (profile != null ? "linked to profile " + profile.getId() : "general user") + ").");


                    } catch (Exception e) {
                        e.printStackTrace();
                        throw new RuntimeException("Failed to approve account request", e);
                    }
                }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
    }

    private String toJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize JSON", e);
        }
    }
}
