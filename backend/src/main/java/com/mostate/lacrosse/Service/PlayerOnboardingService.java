package com.mostate.lacrosse.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.mostate.lacrosse.Model.InviteToken;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.InviteTokenRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Utils.JsonUtils;

/**
 * Creates the Firebase account, UserAccount row, and welcome email for a player
 * who did not have login access before. Used by PlayersController when a roster
 * edit adds an email to a player who had none (see hasAccount() guard there), and
 * is the same underlying action as OnboardingController's explicit "Onboard
 * Player" admin flow - just triggered implicitly instead of via a dedicated form.
 */
@Service
public class PlayerOnboardingService {
    private static final Logger log = LoggerFactory.getLogger(PlayerOnboardingService.class);

    private final UserAccountRepository userRepo;
    private final InviteTokenRepository inviteTokenRepo;
    private final EmailService emailService;

    public PlayerOnboardingService(
        UserAccountRepository userRepo,
        InviteTokenRepository inviteTokenRepo,
        EmailService emailService
    ) {
        this.userRepo = userRepo;
        this.inviteTokenRepo = inviteTokenRepo;
        this.emailService = emailService;
    }

    /** True if a login account already exists for this email - onboarding should not re-fire. */
    public boolean hasAccount(String email) {
        return email != null && !email.isBlank() && userRepo.findFirstByEmailIgnoreCase(email).isPresent();
    }

    /**
     * Creates the Firebase user (or reuses one that already exists under this email
     * with no local UserAccount yet), a UserAccount with a "player" role for
     * `program`, and sends the welcome email. Swallows and logs its own failures -
     * this runs as a side effect of a roster save, which must still succeed even if
     * account creation or email delivery has a problem. Returns the Firebase uid so
     * the caller can link its Player row to it (mirrors what the explicit "Onboard
     * Player" admin flow does), or null if onboarding failed.
     */
    public String onboardPlayer(String email, String displayName, String program, UUID profileId) {
        try {
            UserRecord userRecord = createOrGetFirebaseUser(email, displayName);
            String resetLink = generateInviteLink(userRecord.getUid(), email, program);

            UserAccount account = userRepo.findByFirebaseUid(userRecord.getUid()).orElseGet(UserAccount::new);
            account.setFirebaseUid(userRecord.getUid());
            account.setEmail(email);
            account.setDisplayName(displayName);
            account.setRoles(JsonUtils.toJson(Map.of(program, "player")));
            account.setPrograms(JsonUtils.toJson(List.of(program)));
            if (profileId != null) {
                account.setPlayerId(profileId);
            }
            userRepo.save(account);

            String programLabel = program.equalsIgnoreCase("women") ? "Women's" : "Men's";
            String portalUrl = "https://missouristatelacrosse.com"
                + (program.equalsIgnoreCase("women") ? "/women/portal" : "/portal");
            String html = welcomeEmail(displayName, programLabel, resetLink, portalUrl);
            boolean sent = emailService.sendEmail(
                email, "Welcome to Missouri State " + programLabel + " Lacrosse!", html
            );
            if (sent) {
                log.info("Onboarded {} ({}) and sent welcome email", email, program);
            } else {
                // The account/invite link were still created - only the email failed. Not
                // fatal (an admin can use "Resend Link" from Manage Players), but silent
                // otherwise, hence the WARN: this is very likely the "why didn't they get an
                // email" report before it's asked.
                log.warn("Onboarded {} ({}) but the welcome email failed to send - see EmailService log above", email, program);
            }
            return userRecord.getUid();
        } catch (Exception e) {
            log.error("Player onboarding failed for {}: {}", email, e.getMessage(), e);
            return null;
        }
    }

    private UserRecord createOrGetFirebaseUser(String email, String displayName) throws FirebaseAuthException {
        try {
            return FirebaseAuth.getInstance().createUser(
                new UserRecord.CreateRequest().setEmail(email).setDisplayName(displayName)
            );
        } catch (FirebaseAuthException e) {
            if (e.getAuthErrorCode() == AuthErrorCode.EMAIL_ALREADY_EXISTS) {
                return FirebaseAuth.getInstance().getUserByEmail(email);
            }
            throw e;
        }
    }

    // Non-expiring link keyed to an InviteToken row, not Firebase's own short-lived
    // action-code URL - mirrors OnboardingController.generateInviteLink(). A coach
    // adding a player's email has no guarantee the player opens the email within
    // Firebase's hard-coded 1-hour oobCode window.
    private String generateInviteLink(String firebaseUid, String email, String program) {
        InviteToken invite = new InviteToken();
        invite.setFirebaseUid(firebaseUid);
        invite.setEmail(email);
        invite = inviteTokenRepo.save(invite);
        return "https://missouristatelacrosse.com/set-password?inviteToken="
            + invite.getToken() + "&program=" + program;
    }

    private static String welcomeEmail(String name, String program, String resetLink, String portalUrl) {
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
                        <p style="font-size:15px;color:#555;margin:0 0 24px;">Your coach added you to the roster with this email, so we've set up your account. Set your password using the button below to get access to the player portal, where you can check your dues balance and team to-dos.</p>
                        <div style="text-align:center;margin:32px 0;">
                          <a href="%s" style="background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Set My Password</a>
                        </div>
                        <p style="font-size:15px;color:#555;margin:0 0 12px;">Once logged in, your player portal is here:</p>
                        <div style="text-align:center;margin:0 0 32px;">
                          <a href="%s" style="background:#f0f0f0;color:#5E0009;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">Go to My Portal</a>
                        </div>
                        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                        <p style="font-size:13px;color:#999;margin:0;">Go Bears! Missouri State %s Lacrosse</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(program.toUpperCase(), name, resetLink, portalUrl, program);
    }
}
