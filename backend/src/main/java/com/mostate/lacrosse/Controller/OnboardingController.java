package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.core.type.TypeReference;
import com.google.firebase.auth.ActionCodeSettings;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.ParentAccount;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.ParentAccountRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@RestController
@RequestMapping("/api/onboard")
@Validated
public class OnboardingController {

    private final UserAccountRepository userRepo;
    private final PlayerRepository playerRepo;
    private final ParentAccountRepository parentRepo;
    private final PlayerProfileService profileService;
    private final EmailService emailService;

    public OnboardingController(
        UserAccountRepository userRepo,
        PlayerRepository playerRepo,
        ParentAccountRepository parentRepo,
        PlayerProfileService profileService,
        EmailService emailService
    ) {
        this.userRepo = userRepo;
        this.playerRepo = playerRepo;
        this.parentRepo = parentRepo;
        this.profileService = profileService;
        this.emailService = emailService;
    }

    /** Admin onboards a new freshman player. Creates Firebase account + player record, sends invite. */
    @PostMapping("/player")
    public ResponseEntity<?> onboardPlayer(@Valid @RequestBody PlayerOnboardRequest body) {
        try {
            String email = TextSanitizer.clean(body.email());
            String displayName = TextSanitizer.clean(body.displayName());
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";

            UserRecord userRecord = createOrGetFirebaseUser(email, displayName);
            String resetLink = generatePasswordLink(email);

            String currentSeason = currentSeason();

            // Find or create player record for this season
            Player player = playerRepo.findFirstByNameIgnoreCaseAndSeason(displayName, currentSeason).orElse(null);
            var profile = profileService.findOrCreateByFirebaseUid(userRecord.getUid(), displayName, email);

            if (player != null) {
                player.setUserUid(userRecord.getUid());
                if (profile != null) player.setProfileId(profile.getId());
                playerRepo.save(player);
            } else {
                player = new Player();
                player.setName(displayName);
                player.setEmail(email);
                player.setSeason(currentSeason);
                player.setUserUid(userRecord.getUid());
                player.setBalance(BigDecimal.ZERO);
                if (profile != null) player.setProfileId(profile.getId());
                playerRepo.save(player);
            }

            // Create or update UserAccount
            UserAccount account = userRepo.findByFirebaseUid(userRecord.getUid()).orElseGet(UserAccount::new);
            account.setFirebaseUid(userRecord.getUid());
            account.setEmail(email);
            account.setDisplayName(displayName);
            account.setRoles(JsonUtils.toJson(Map.of(program, "player")));
            account.setPrograms(JsonUtils.toJson(List.of(program)));
            if (profile != null) account.setPlayerId(profile.getId());
            userRepo.save(account);

            // Send welcome email
            if (resetLink != null) {
                String programLabel = program.equals("women") ? "Women's" : "Men's";
                String duesUrl = "https://missouristatelacrosse.com" + (program.equals("women") ? "/women/dues" : "/dues");
                String html = playerWelcomeEmail(displayName, programLabel, resetLink, duesUrl);
                emailService.sendEmail(email, "Welcome to Missouri State " + programLabel + " Lacrosse!", html);
            }

            return ResponseEntity.ok(Map.of("uid", userRecord.getUid(), "email", email));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /** Sends a branded password-reset email. Open endpoint — never reveals whether account exists. */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest body) {
        try {
            String email = TextSanitizer.clean(body.email());
            String resetLink = generatePasswordLink(email);
            if (resetLink != null) {
                String displayName = userRepo.findFirstByEmailIgnoreCase(email)
                    .map(u -> u.getDisplayName() != null ? u.getDisplayName() : "there")
                    .orElse("there");
                emailService.sendEmail(email, "Reset your Missouri State Lacrosse password", resetPasswordEmail(displayName, resetLink));
            }
            // Always return 200 so callers can't probe for valid emails
            return ResponseEntity.ok(Map.of("sent", true));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("sent", true));
        }
    }

    /** Player-initiated: onboards a parent by email. Creates Firebase account and links to the given player. */
    @PostMapping("/parent")
    public ResponseEntity<?> onboardParent(@Valid @RequestBody ParentOnboardRequest body) {
        try {
            String email = TextSanitizer.clean(body.email());
            String parentName = body.parentName() != null ? TextSanitizer.clean(body.parentName()) : "Parent";
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";
            UUID playerId = body.playerId();

            Player player = playerRepo.findById(playerId).orElse(null);
            if (player == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
            }

            UserRecord userRecord = createOrGetFirebaseUser(email, parentName);
            String resetLink = generatePasswordLink(email);

            // Create or update UserAccount with parent role
            UserAccount account = userRepo.findByFirebaseUid(userRecord.getUid()).orElseGet(UserAccount::new);
            account.setFirebaseUid(userRecord.getUid());
            account.setEmail(email);
            account.setDisplayName(parentName);
            // Merge role in case they already have other program roles
            Map<String, Object> roles = new HashMap<>(JsonUtils.readMap(account.getRoles()));
            roles.put(program, "parent");
            account.setRoles(JsonUtils.toJson(roles));
            List<Object> existingPrograms = new ArrayList<>(JsonUtils.readList(account.getPrograms()));
            if (!existingPrograms.contains(program)) existingPrograms.add(program);
            account.setPrograms(JsonUtils.toJson(existingPrograms));
            userRepo.save(account);

            // Create or update ParentAccount record
            ParentAccount parentAccount = parentRepo.findById(userRecord.getUid()).orElseGet(ParentAccount::new);
            parentAccount.setId(userRecord.getUid());
            parentAccount.setEmail(email);
            List<Object> linkedPlayers = new ArrayList<>(JsonUtils.readList(parentAccount.getLinkedPlayers()));
            String playerIdStr = playerId.toString();
            if (!linkedPlayers.contains(playerIdStr)) linkedPlayers.add(playerIdStr);
            parentAccount.setLinkedPlayers(JsonUtils.toJson(linkedPlayers));
            parentRepo.save(parentAccount);

            // Update Player.parents to include this parent with uid
            List<Map<String, Object>> parents = JsonUtils.readList(
                player.getParents(),
                new TypeReference<List<Map<String, Object>>>() {}
            );
            parents = new ArrayList<>(parents);
            boolean alreadyLinked = parents.stream()
                .anyMatch(p -> email.equalsIgnoreCase(String.valueOf(p.getOrDefault("email", ""))));
            if (!alreadyLinked) {
                Map<String, Object> parentEntry = new HashMap<>();
                parentEntry.put("uid", userRecord.getUid());
                parentEntry.put("email", email);
                parents.add(parentEntry);
            } else {
                // Update uid on existing entry if missing
                parents = parents.stream().map(p -> {
                    if (email.equalsIgnoreCase(String.valueOf(p.getOrDefault("email", "")))) {
                        Map<String, Object> updated = new HashMap<>(p);
                        updated.put("uid", userRecord.getUid());
                        return updated;
                    }
                    return p;
                }).collect(java.util.stream.Collectors.toList());
            }
            player.setParents(JsonUtils.toJson(parents));
            playerRepo.save(player);

            // Send welcome email to parent
            if (resetLink != null) {
                String programLabel = program.equals("women") ? "Women's" : "Men's";
                String html = parentWelcomeEmail(parentName, player.getName(), programLabel, resetLink);
                emailService.sendEmail(email, "You've Been Added to Missouri State " + programLabel + " Lacrosse", html);
            }

            return ResponseEntity.ok(Map.of("uid", userRecord.getUid(), "email", email));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    private UserRecord createOrGetFirebaseUser(String email, String displayName) throws FirebaseAuthException {
        try {
            return FirebaseAuth.getInstance().createUser(
                new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setDisplayName(displayName != null ? displayName : "")
            );
        } catch (FirebaseAuthException e) {
            if (e.getAuthErrorCode() == AuthErrorCode.EMAIL_ALREADY_EXISTS) {
                return FirebaseAuth.getInstance().getUserByEmail(email);
            }
            throw e;
        }
    }

    private String generatePasswordLink(String email) {
        try {
            String firebaseLink = FirebaseAuth.getInstance().generatePasswordResetLink(
                email,
                ActionCodeSettings.builder()
                    .setUrl("https://missouristatelacrosse.com/set-password")
                    .setHandleCodeInApp(false)
                    .build()
            );
            // Extract oobCode and build our own custom page URL
            java.net.URI uri = java.net.URI.create(firebaseLink);
            String query = uri.getQuery();
            String oobCode = null;
            if (query != null) {
                for (String param : query.split("&")) {
                    if (param.startsWith("oobCode=")) {
                        oobCode = java.net.URLDecoder.decode(param.substring("oobCode=".length()), java.nio.charset.StandardCharsets.UTF_8);
                        break;
                    }
                }
            }
            if (oobCode != null) {
                return "https://missouristatelacrosse.com/set-password?oobCode="
                    + java.net.URLEncoder.encode(oobCode, java.nio.charset.StandardCharsets.UTF_8)
                    + "&mode=resetPassword";
            }
            return firebaseLink;
        } catch (Exception e) {
            System.err.println("Failed to generate password link for " + email + ": " + e.getMessage());
            return null;
        }
    }

    private String currentSeason() {
        LocalDate now = LocalDate.now();
        int year = now.getYear();
        int month = now.getMonthValue();
        int start = month >= 7 ? year : year - 1;
        return (start % 100) + "-" + ((start + 1) % 100);
    }

    private static String playerWelcomeEmail(String name, String program, String resetLink, String duesUrl) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
                    <tr>
                      <td style="background:#5E0009;padding:28px 40px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">MISSOURI STATE %s LACROSSE</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="font-size:16px;color:#333;margin:0 0 16px;">Hey %s,</p>
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">Welcome to the team! Your account has been created. Set your password using the button below to get access to the player portal.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Set My Password</a>
                        </div>
                        <p style="font-size:15px;color:#555;margin:0 0 12px;">Once logged in, you can view your dues balance here:</p>
                        <div style="text-align:center;margin:0 0 32px;">
                          <a href="%s" style="background:#f0f0f0;color:#5E0009;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">View My Dues</a>
                        </div>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! &mdash; Missouri State %s Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(program.toUpperCase(), name, resetLink, duesUrl, program);
    }

    private static String parentWelcomeEmail(String parentName, String playerName, String program, String resetLink) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
                    <tr>
                      <td style="background:#5E0009;padding:28px 40px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">MISSOURI STATE %s LACROSSE</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="font-size:16px;color:#333;margin:0 0 16px;">Hello %s,</p>
                        <p style="font-size:15px;color:#555;margin:0 0 12px;"><strong>%s</strong> has added you as a parent contact for Missouri State %s Lacrosse.</p>
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">Set your password using the button below to view your player&rsquo;s payment information and stay up to date with the team.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Set My Password</a>
                        </div>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! &mdash; Missouri State %s Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(program.toUpperCase(), parentName, playerName, program, resetLink, program);
    }

    public record PlayerOnboardRequest(
        @Email @NotBlank String email,
        @NotBlank String displayName,
        String program
    ) {}

    /** Admin onboards an alumni member. Creates Firebase account and sends a thank-you invite. */
    @PostMapping("/alumni")
    public ResponseEntity<?> onboardAlumni(@Valid @RequestBody AlumniOnboardRequest body) {
        try {
            String email = TextSanitizer.clean(body.email());
            String displayName = body.displayName() != null ? TextSanitizer.clean(body.displayName()) : "Alumni";
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";

            UserRecord userRecord = createOrGetFirebaseUser(email, displayName);
            String resetLink = generatePasswordLink(email);

            UserAccount account = userRepo.findByFirebaseUid(userRecord.getUid()).orElseGet(UserAccount::new);
            account.setFirebaseUid(userRecord.getUid());
            account.setEmail(email);
            account.setDisplayName(displayName);
            Map<String, Object> roles = new HashMap<>(JsonUtils.readMap(account.getRoles()));
            roles.put(program, "alumni");
            account.setRoles(JsonUtils.toJson(roles));
            List<Object> existingPrograms = new ArrayList<>(JsonUtils.readList(account.getPrograms()));
            if (!existingPrograms.contains(program)) existingPrograms.add(program);
            account.setPrograms(JsonUtils.toJson(existingPrograms));
            userRepo.save(account);

            if (resetLink != null) {
                String programLabel = program.equals("women") ? "Women's" : "Men's";
                String html = alumniWelcomeEmail(displayName, programLabel, resetLink);
                emailService.sendEmail(email, "Welcome to Missouri State " + programLabel + " Lacrosse Alumni", html);
            }

            return ResponseEntity.ok(Map.of("uid", userRecord.getUid(), "email", email));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    private static String alumniWelcomeEmail(String name, String program, String resetLink) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
                    <tr>
                      <td style="background:#5E0009;padding:28px 40px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">MISSOURI STATE %s LACROSSE</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="font-size:16px;color:#333;margin:0 0 16px;">Hey %s,</p>
                        <p style="font-size:15px;color:#555;margin:0 0 16px;">Thank you for your continued support of Missouri State %s Lacrosse &mdash; alumni like you are what keep this program going.</p>
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">Your alumni account has been created. Set your password using the button below to access the alumni portal.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Set My Password</a>
                        </div>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! &mdash; Missouri State %s Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(program.toUpperCase(), name, program, resetLink, program);
    }

    private static String resetPasswordEmail(String name, String resetLink) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
                    <tr>
                      <td style="background:#5E0009;padding:28px 40px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">MISSOURI STATE LACROSSE</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="font-size:16px;color:#333;margin:0 0 16px;">Hey %s,</p>
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Reset My Password</a>
                        </div>
                        <p style="font-size:13px;color:#999;margin:0 0 8px;">If you didn't request this, you can ignore this email. Your password won't change.</p>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! &mdash; Missouri State Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(name, resetLink);
    }

    public record ForgotPasswordRequest(@Email @NotBlank String email) {}

    public record AlumniOnboardRequest(
        @Email @NotBlank String email,
        String displayName,
        String program
    ) {}

    public record ParentOnboardRequest(
        @Email @NotBlank String email,
        String parentName,
        String program,
        @NotNull UUID playerId
    ) {}
}
