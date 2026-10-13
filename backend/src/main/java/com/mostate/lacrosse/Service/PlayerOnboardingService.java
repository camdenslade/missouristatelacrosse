package com.mostate.lacrosse.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
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

    /** Public address of the website, used in links we email and in payment return addresses. */
    @org.springframework.beans.factory.annotation.Value("${app.frontend.base-url:https://missouristatelacrosse.com}")
    private String frontendBaseUrl = "https://missouristatelacrosse.com";

    private static final Logger log = LoggerFactory.getLogger(PlayerOnboardingService.class);

    private final UserAccountRepository userRepo;
    private final InviteTokenRepository inviteTokenRepo;
    private final EmailService emailService;
    private final IdentityService identityService;

    public PlayerOnboardingService(
        UserAccountRepository userRepo,
        InviteTokenRepository inviteTokenRepo,
        EmailService emailService,
        IdentityService identityService
    ) {
        this.userRepo = userRepo;
        this.inviteTokenRepo = inviteTokenRepo;
        this.emailService = emailService;
        this.identityService = identityService;
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
            IdentityService.Account userRecord = identityService.createOrGetAccount(email, displayName);
            String resetLink = generateInviteLink(userRecord.getUid(), email, program);

            UserAccount account = userRepo.findByFirebaseUid(userRecord.getUid()).orElseGet(UserAccount::new);
            account.setFirebaseUid(userRecord.getUid());
            if (userRecord.cognitoSub() != null) {
                account.setCognitoSub(userRecord.cognitoSub());
            }
            account.setEmail(email);
            account.setDisplayName(displayName);
            account.setRoles(JsonUtils.toJson(Map.of(program, "player")));
            account.setPrograms(JsonUtils.toJson(List.of(program)));
            if (profileId != null) {
                account.setPlayerId(profileId);
            }
            userRepo.save(account);

            String programLabel = program.equalsIgnoreCase("women") ? "Women's" : "Men's";
            String portalUrl = frontendBaseUrl
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

    /**
     * A player who already has an account gets their email changed (from either
     * Payments > Manage's Player.email or Manage Players' UserAccount.email - both
     * propagate to each other, see PlayersController.syncExistingAccountEmail() and
     * UsersController.upsert()). Two things must happen, and previously neither did:
     *   1. The sign-in provider's own email has to be updated too, or the player
     *      can never again log in with the new address - Firebase looks accounts up
     *      by its own stored email, not by anything in our database.
     *   2. The player needs to actually be told, at the new address, since they may
     *      not be watching the old one any more (that can be exactly why it changed).
     * Swallows and logs its own failures, same rationale as onboardPlayer(): this is
     * a side effect of a roster/account save that must still succeed on its own.
     */
    public void notifyEmailChanged(String firebaseUid, String newEmail, String displayName, String program) {
        if (firebaseUid == null || firebaseUid.isBlank() || newEmail == null || newEmail.isBlank()) {
            return;
        }
        try {
            if (!identityService.changeEmail(firebaseUid, newEmail)) {
                // Most likely the new address already belongs to a different account.
                // Don't send a "here's your account" link for an email change that didn't
                // actually take effect with the auth provider.
                log.error("Failed to update sign-in email for uid {} to {} - not sending a notice", firebaseUid, newEmail);
                return;
            }

            String resetLink = generateInviteLink(firebaseUid, newEmail, program);
            String programLabel = program.equalsIgnoreCase("women") ? "Women's" : "Men's";
            String portalUrl = frontendBaseUrl
                + (program.equalsIgnoreCase("women") ? "/women/portal" : "/portal");
            String html = emailChangedEmail(displayName, programLabel, resetLink, portalUrl);
            boolean sent = emailService.sendEmail(
                newEmail, "Your Missouri State Lacrosse account email was updated", html
            );
            if (sent) {
                log.info("Notified {} of account email change ({})", newEmail, program);
            } else {
                log.warn("Firebase email updated to {} but the notice email failed to send - see EmailService log above", newEmail);
            }
        } catch (Exception e) {
            log.error("notifyEmailChanged failed for uid {} -> {}: {}", firebaseUid, newEmail, e.getMessage(), e);
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
        return frontendBaseUrl + "/set-password?inviteToken="
            + invite.getToken() + "&program=" + program;
    }

    private static final String TROUBLE_LOGGING_IN =
        "<p style=\"font-size:11px;color:#bbb;margin:8px 0 0;\">Trouble logging in? "
        + "<a href=\"mailto:support@missouristatelacrosse.com\" style=\"color:#bbb;\">support@missouristatelacrosse.com</a></p>";

    private static String welcomeEmail(String name, String program, String resetLink, String portalUrl) {
        String body = com.mostate.lacrosse.Utils.EmailTemplate.paragraph("Hey " + name + ",")
            + com.mostate.lacrosse.Utils.EmailTemplate.paragraph("Your coach added you to the roster with this email, so we've set up your account. Set your password using the button below to get access to the player portal, where you can check your dues balance and team to-dos.")
            + com.mostate.lacrosse.Utils.EmailTemplate.button(resetLink, "Set My Password")
            + com.mostate.lacrosse.Utils.EmailTemplate.paragraph("Once logged in, your player portal is here:")
            + com.mostate.lacrosse.Utils.EmailTemplate.button(portalUrl, "Go to My Portal")
            + TROUBLE_LOGGING_IN;
        return com.mostate.lacrosse.Utils.EmailTemplate.wrap(program, body);
    }

    private static String emailChangedEmail(String name, String program, String resetLink, String portalUrl) {
        String body = com.mostate.lacrosse.Utils.EmailTemplate.paragraph("Hey " + name + ",")
            + com.mostate.lacrosse.Utils.EmailTemplate.paragraph("Your coach updated your account to use this email address. If you haven't set a password yet, or want to set a new one, use the button below.")
            + com.mostate.lacrosse.Utils.EmailTemplate.button(resetLink, "Set My Password")
            + com.mostate.lacrosse.Utils.EmailTemplate.paragraph("Your player portal is here:")
            + com.mostate.lacrosse.Utils.EmailTemplate.button(portalUrl, "Go to My Portal")
            + TROUBLE_LOGGING_IN;
        return com.mostate.lacrosse.Utils.EmailTemplate.wrap(program, body);
    }
}
