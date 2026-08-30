package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.ParentAccount;
import com.mostate.lacrosse.Model.InviteToken;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.ParentAccountRepository;
import com.mostate.lacrosse.Repository.InviteTokenRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Service.SeasonService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;
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
    private final InviteTokenRepository inviteTokenRepo;
    private final PlayerProfileService profileService;
    private final EmailService emailService;
    private final AuthorizationService authorizationService;
    private final SeasonService seasonService;

    public OnboardingController(
        UserAccountRepository userRepo,
        PlayerRepository playerRepo,
        ParentAccountRepository parentRepo,
        InviteTokenRepository inviteTokenRepo,
        PlayerProfileService profileService,
        EmailService emailService,
        AuthorizationService authorizationService,
        SeasonService seasonService
    ) {
        this.userRepo = userRepo;
        this.playerRepo = playerRepo;
        this.parentRepo = parentRepo;
        this.inviteTokenRepo = inviteTokenRepo;
        this.profileService = profileService;
        this.emailService = emailService;
        this.authorizationService = authorizationService;
        this.seasonService = seasonService;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    private String callerUid(HttpServletRequest request) {
        return (String) request.getAttribute("firebaseUid");
    }

    /** Admin onboards a new freshman player. Creates Firebase account + player record, sends invite. */
    @PostMapping("/player")
    public ResponseEntity<?> onboardPlayer(HttpServletRequest request, @Valid @RequestBody PlayerOnboardRequest body) {
        try {
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";
            if (!isAdmin(request, program)) {
                return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
            }
            String email = TextSanitizer.clean(body.email());
            String displayName = TextSanitizer.clean(body.displayName());

            UserRecord userRecord = createOrGetFirebaseUser(email, displayName);
            String resetLink = generateInviteLink(userRecord.getUid(), email, program);

            String currentSeason = currentSeason();

            // Link to an explicitly chosen existing roster player (admin confirmed a match
            // from the dedupe picker), otherwise fall back to an exact name match, otherwise create new.
            Player player = body.linkPlayerId() != null
                ? playerRepo.findById(body.linkPlayerId()).orElse(null)
                : playerRepo.findFirstByNameIgnoreCaseAndSeason(displayName, currentSeason).orElse(null);

            // Reuse an existing profile for this person if one already exists — e.g. a
            // placeholder the Roster page created (name+school merge key) back when they had
            // no email on file. Without this, onboarding always mints a brand-new
            // uid-keyed profile, fragmenting the same person's history across two records
            // (exactly the Abe Mercer / duplicate-profile class of bug found in prod).
            // findOrCreateByFirebaseUid() is still the fallback for genuinely new people.
            UUID existingProfileId = player != null ? player.getProfileId() : null;
            if (existingProfileId == null && displayName != null && !displayName.isBlank()) {
                existingProfileId = playerRepo.findAllByNameIgnoreCase(displayName).stream()
                    .map(Player::getProfileId)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            }
            var profile = existingProfileId != null ? profileService.findById(existingProfileId) : null;
            if (profile != null) {
                profileService.setFirebaseUid(profile.getId(), userRecord.getUid());
                if (email != null && !email.isBlank()) {
                    profileService.setEmail(profile.getId(), email);
                }
            } else {
                profile = profileService.findOrCreateByFirebaseUid(userRecord.getUid(), displayName, email);
            }

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

    /** Player-initiated (or admin-initiated): onboards a parent by email. Creates Firebase account and links to the given player. */
    @PostMapping("/parent")
    public ResponseEntity<?> onboardParent(HttpServletRequest request, @Valid @RequestBody ParentOnboardRequest body) {
        try {
            String email = TextSanitizer.clean(body.email());
            String parentName = body.parentName() != null ? TextSanitizer.clean(body.parentName()) : "Parent";
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";
            UUID playerId = body.playerId();

            Player player = playerRepo.findById(playerId).orElse(null);
            if (player == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
            }

            String callerUid = callerUid(request);
            boolean isSelf = profileService.isSelf(player, callerUid);
            if (!isSelf && !isAdmin(request, program)) {
                return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
            }

            UserRecord userRecord = createOrGetFirebaseUser(email, parentName);
            String resetLink = generateInviteLink(userRecord.getUid(), email, program);

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

            linkParentToPlayer(player, userRecord.getUid(), email);

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

    /**
     * Admin links an EXISTING account (already has a UserAccount — e.g. approved from an
     * account request, or already a parent of another player) to a player, without creating
     * a new Firebase user or resending a "set your password" invite. Second path alongside
     * `/parent`, which is for parents who don't have an account yet.
     */
    @PostMapping("/link-existing-parent")
    public ResponseEntity<?> linkExistingParent(HttpServletRequest request, @Valid @RequestBody LinkExistingParentRequest body) {
        try {
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";
            if (!isAdmin(request, program)) {
                return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
            }

            String email = TextSanitizer.clean(body.parentEmail());
            Player player = playerRepo.findById(body.playerId()).orElse(null);
            if (player == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
            }

            UserAccount account = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
            if (account == null || account.getFirebaseUid() == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse(
                    "No existing account found with that email — use \"Invite New Parent\" instead."
                ));
            }

            // Never silently downgrade an existing admin for this program — but a plain/blank
            // role (e.g. "user" from a prior self-registration) should still be upgraded to
            // "parent", otherwise linking never actually grants Payments-tab access.
            Map<String, Object> roles = new HashMap<>(JsonUtils.readMap(account.getRoles()));
            Object existingRole = roles.get(program);
            boolean isElevated = existingRole != null && "admin".equalsIgnoreCase(String.valueOf(existingRole));
            if (!isElevated) {
                roles.put(program, "parent");
                account.setRoles(JsonUtils.toJson(roles));
            }
            List<Object> existingPrograms = new ArrayList<>(JsonUtils.readList(account.getPrograms()));
            if (!existingPrograms.contains(program)) existingPrograms.add(program);
            account.setPrograms(JsonUtils.toJson(existingPrograms));
            userRepo.save(account);

            linkParentToPlayer(player, account.getFirebaseUid(), email);

            // Lightweight notification only — no password reset link, they already have an account.
            String programLabel = program.equals("women") ? "Women's" : "Men's";
            String parentName = account.getDisplayName() != null ? account.getDisplayName() : "there";
            String html = parentLinkedNotificationEmail(parentName, player.getName(), programLabel);
            emailService.sendEmail(email, "You've Been Linked to a Player at Missouri State " + programLabel + " Lacrosse", html);

            return ResponseEntity.ok(Map.of("uid", account.getFirebaseUid(), "email", email));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Admin-triggered resend of the "set your password" link — for any user who never
     * finished onboarding (e.g. their original invite email was opened after Firebase's old
     * 1-hour link had already died) or just needs a new one. Issues a fresh, non-expiring
     * invite token rather than a real Firebase reset link.
     */
    @PostMapping("/resend-invite")
    public ResponseEntity<?> resendInvite(HttpServletRequest request, @Valid @RequestBody ResendInviteRequest body) {
        try {
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";
            if (!isAdmin(request, program)) {
                return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
            }
            UserAccount account = userRepo.findByFirebaseUid(body.uid()).orElse(null);
            if (account == null || account.getEmail() == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("User not found or has no email on file"));
            }
            String link = generateInviteLink(account.getFirebaseUid(), account.getEmail(), program);
            String name = account.getDisplayName() != null ? account.getDisplayName() : "there";
            emailService.sendEmail(account.getEmail(), "Set your Missouri State Lacrosse password", resendInviteEmail(name, link));
            return ResponseEntity.ok(Map.of("sent", true));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Verifies a parent invite token before the set-password form is shown (mirrors
     * Firebase's verifyPasswordResetCode step for the old oobCode flow) and returns the
     * email it belongs to. Public — the token itself is the credential.
     */
    @org.springframework.web.bind.annotation.GetMapping("/invite/{token}")
    public ResponseEntity<?> verifyInvite(@org.springframework.web.bind.annotation.PathVariable UUID token) {
        InviteToken invite = inviteTokenRepo.findById(token).orElse(null);
        if (invite == null || invite.getUsedAt() != null) {
            return ResponseEntity.status(410).body(new ErrorResponse("This invite link is invalid or has already been used."));
        }
        return ResponseEntity.ok(Map.of("email", invite.getEmail()));
    }

    /**
     * Consumes a parent invite token, setting the chosen password directly via the Admin SDK
     * instead of going through Firebase's own (1-hour, non-configurable) reset-link flow.
     * Public — the token itself is the credential, same trust model as the oobCode it replaces.
     */
    @PostMapping("/consume-invite")
    public ResponseEntity<?> consumeInvite(@Valid @RequestBody ConsumeInviteRequest body) {
        try {
            InviteToken invite = inviteTokenRepo.findById(body.token()).orElse(null);
            if (invite == null || invite.getUsedAt() != null) {
                return ResponseEntity.status(410).body(new ErrorResponse("This invite link is invalid or has already been used."));
            }
            FirebaseAuth.getInstance().updateUser(
                new UserRecord.UpdateRequest(invite.getFirebaseUid()).setPassword(body.password())
            );
            invite.setUsedAt(java.time.Instant.now());
            inviteTokenRepo.save(invite);
            return ResponseEntity.ok(Map.of("email", invite.getEmail()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Shared by /parent (new account) and /link-existing-parent (existing account): links a
     * parent uid/email to a player's ParentAccount.linkedPlayers and Player.parents (mirrored
     * to PlayerProfile.parents when available).
     */
    private void linkParentToPlayer(Player player, String parentUid, String parentEmail) {
        // Link by the player's stable, season-independent profile id when available (so this
        // link survives a season rollover without re-linking); fall back to the raw player row
        // id for legacy players with no profile yet. PlayersController.get() already resolves a
        // profile id to "this season's row" for either case.
        ParentAccount parentAccount = parentRepo.findById(parentUid).orElseGet(ParentAccount::new);
        parentAccount.setId(parentUid);
        parentAccount.setEmail(parentEmail);
        List<Object> linkedPlayers = new ArrayList<>(JsonUtils.readList(parentAccount.getLinkedPlayers()));
        String linkedId = player.getProfileId() != null ? player.getProfileId().toString() : player.getId().toString();
        if (!linkedPlayers.contains(linkedId)) linkedPlayers.add(linkedId);
        parentAccount.setLinkedPlayers(JsonUtils.toJson(linkedPlayers));
        parentRepo.save(parentAccount);

        // Update Player.parents to include this parent with uid
        List<Map<String, Object>> parents = JsonUtils.readList(
            player.getParents(),
            new TypeReference<List<Map<String, Object>>>() {}
        );
        parents = new ArrayList<>(parents);
        boolean alreadyLinked = parents.stream()
            .anyMatch(p -> parentEmail.equalsIgnoreCase(String.valueOf(p.getOrDefault("email", ""))));
        if (!alreadyLinked) {
            Map<String, Object> parentEntry = new HashMap<>();
            parentEntry.put("uid", parentUid);
            parentEntry.put("email", parentEmail);
            parents.add(parentEntry);
        } else {
            // Update uid on existing entry if missing
            parents = parents.stream().map(p -> {
                if (parentEmail.equalsIgnoreCase(String.valueOf(p.getOrDefault("email", "")))) {
                    Map<String, Object> updated = new HashMap<>(p);
                    updated.put("uid", parentUid);
                    return updated;
                }
                return p;
            }).collect(java.util.stream.Collectors.toList());
        }
        String parentsJson = JsonUtils.toJson(parents);
        player.setParents(parentsJson);
        playerRepo.save(player);
        if (player.getProfileId() != null) {
            profileService.setParents(player.getProfileId(), parentsJson);
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

    /**
     * Non-expiring alternative to generatePasswordLink() for onboarding emails (player,
     * parent, alumni) and admin-triggered resends, none of which can be relied on to be
     * opened within Firebase's hard-coded, non-configurable 1-hour oobCode window.
     * `program` is embedded in the URL since /set-password has no /women/ prefix to derive
     * it from client-side. The real "forgot password" flow deliberately keeps using
     * Firebase's own short-lived link — different trust model, existing user self-service.
     */
    private String generateInviteLink(String firebaseUid, String email, String program) {
        InviteToken invite = new InviteToken();
        invite.setFirebaseUid(firebaseUid);
        invite.setEmail(email);
        invite = inviteTokenRepo.save(invite);
        return "https://missouristatelacrosse.com/set-password?inviteToken="
            + invite.getToken() + "&program=" + program;
    }

    private String currentSeason() {
        return seasonService.getActiveCode();
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

    private static String parentLinkedNotificationEmail(String parentName, String playerName, String program) {
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
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">You've been added as a parent contact for <strong>%s</strong> at Missouri State %s Lacrosse. Log in with your existing account to view their payment information and stay up to date with the team.</p>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! &mdash; Missouri State %s Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(program.toUpperCase(), parentName, playerName, program, program);
    }

    public record ConsumeInviteRequest(
        @NotNull UUID token,
        @NotBlank String password
    ) {}

    public record PlayerOnboardRequest(
        @Email @NotBlank String email,
        @NotBlank String displayName,
        String program,
        UUID linkPlayerId
    ) {}

    /** Admin onboards an alumni member. Creates Firebase account and sends a thank-you invite. */
    // Intentionally public/self-service — also used by the anonymous AlumniJoin.tsx signup
    // form, not just the admin AccountRequests tab. Same "open by design" precedent as
    // account-request submission: creates only a plain "alumni" role account, no link to
    // any existing sensitive resource by id, so no admin gate here.
    @PostMapping("/alumni")
    public ResponseEntity<?> onboardAlumni(@Valid @RequestBody AlumniOnboardRequest body) {
        try {
            String email = TextSanitizer.clean(body.email());
            String displayName = body.displayName() != null ? TextSanitizer.clean(body.displayName()) : "Alumni";
            String program = body.program() != null ? TextSanitizer.clean(body.program()).toLowerCase() : "men";

            UserRecord userRecord = createOrGetFirebaseUser(email, displayName);
            String resetLink = generateInviteLink(userRecord.getUid(), email, program);

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

    private static String resendInviteEmail(String name, String resetLink) {
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
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">An admin sent you a new link to set your password. Click the button below to choose one.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Set My Password</a>
                        </div>
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

    public record LinkExistingParentRequest(
        @Email @NotBlank String parentEmail,
        String program,
        @NotNull UUID playerId
    ) {}

    public record ResendInviteRequest(
        @NotBlank String uid,
        String program
    ) {}
}
