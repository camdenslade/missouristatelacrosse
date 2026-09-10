package com.mostate.lacrosse.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.mostate.lacrosse.Model.AccountRequestModel;
import com.mostate.lacrosse.Model.InviteToken;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.AccountRequestRepository;
import com.mostate.lacrosse.Repository.InviteTokenRepository;
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
    private final SeasonService seasonService;
    private final InviteTokenRepository inviteTokenRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public AccountRequestService(
        AccountRequestRepository repository,
        EmailService emailService,
        UserAccountRepository userRepository,
        PlayerRepository playerRepository,
        PlayerProfileService profileService,
        SeasonService seasonService,
        InviteTokenRepository inviteTokenRepository
    ) {
        this.repository = repository;
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.playerRepository = playerRepository;
        this.profileService = profileService;
        this.seasonService = seasonService;
        this.inviteTokenRepository = inviteTokenRepository;
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
            System.out.println("[" + program + "] Request rejected and deleted: " + id);
        } catch (Exception e) {
            throw new RuntimeException("Failed to reject account request", e);
        }
    }

    public void approveRequest(String id, String program, String role) {
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
            String sanitizedRole = TextSanitizer.clean(role);
            String effectiveRole = (sanitizedRole != null && !sanitizedRole.isEmpty())
                    ? sanitizedRole.toLowerCase()
                    : "user";

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

            // Non-expiring InviteToken link, not a raw Firebase reset link: an approved
            // applicant may not open this email within Firebase's hard-coded 1-hour oobCode
            // window. Same rationale as the player/parent/alumni onboarding emails in
            // OnboardingController.
            String resetLink = generateInviteLink(userRecord.getUid(), email, effectiveProgram);

            try {
                String subject = "Your Missouri State Lacrosse Account Has Been Approved";
                String body = approvalEmail(displayName, capitalize(effectiveProgram), resetLink);
                emailService.sendEmail(email, subject, body);
            } catch (Exception mailEx) {
                System.err.println("Email sending failed: " + mailEx.getMessage());
            }

            String currentSeason = seasonService.getActiveCode();


            // Only link to an existing roster player — never create a new one here.
            // This request is self-service (e.g. alumni signing up), so we can't assume
            // the requester should be added to the roster as a player. The admin picks the
            // role explicitly at approval time; we only touch the roster if that role is "player".
            var profile = profileService.findOrCreateByFirebaseUid(
                userRecord.getUid(),
                displayName,
                email
            );
            Map<String, Object> roles = new HashMap<>();
            roles.put(effectiveProgram, effectiveRole);
            if ("player".equals(effectiveRole)) {
                Player player = playerRepository
                    .findFirstByNameIgnoreCaseAndSeason(displayName, currentSeason)
                    .orElse(null);
                if (player != null) {
                    player.setUserUid(userRecord.getUid());
                    if (profile != null) {
                        player.setProfileId(profile.getId());
                    }
                    playerRepository.save(player);
                }
            }

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

    // Mirrors OnboardingController.generateInviteLink(): a short, non-expiring link keyed
    // to an InviteToken row, not the long raw Firebase action-code URL.
    private String generateInviteLink(String firebaseUid, String email, String program) {
        InviteToken invite = new InviteToken();
        invite.setFirebaseUid(firebaseUid);
        invite.setEmail(email);
        invite = inviteTokenRepository.save(invite);
        return "https://missouristatelacrosse.com/set-password?inviteToken="
            + invite.getToken() + "&program=" + program;
    }

    private static String approvalEmail(String name, String program, String resetLink) {
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
                        <p style="font-size:16px;color:#333;margin:0 0 16px;">Hello %s,</p>
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">Your account for the %s program has been approved. Set your password using the button below to get access.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Set My Password</a>
                        </div>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! Welcome to the team.</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(name, program, resetLink);
    }

    private String toJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize JSON", e);
        }
    }
}
