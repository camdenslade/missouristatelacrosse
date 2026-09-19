package com.mostate.lacrosse.Service;

import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminCreateUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminSetUserPasswordRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminUpdateUserAttributesRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.MessageActionType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserNotFoundException;

import java.util.List;
import java.util.UUID;

/**
 * The one place that talks to the auth provider (Cognito) about accounts.
 *
 * Every account has two ids that must never be confused:
 *   - uid: an opaque id we own. It is what users, profiles, players, parents, invites and
 *     payments store. It never depends on the auth provider and never changes. Accounts that
 *     predate Cognito keep the uid they already have; new accounts get a generated one.
 *   - cognito sub: the provider's id, stored only on users.cognito_sub. If a Cognito account is
 *     ever deleted and recreated, that single column changes and nothing else does.
 *
 * Without a configured user pool (local development, tests) the provider calls are skipped and
 * only uid resolution runs.
 */
@Service
public class IdentityService {

    private static final Logger log = LoggerFactory.getLogger(IdentityService.class);

    /** The account a caller should use. cognitoSub is null when Cognito is not configured. */
    public record Account(String uid, String cognitoSub) {
        public String getUid() {
            return uid;
        }
    }

    private final UserAccountRepository users;
    private final String userPoolId;
    private final CognitoIdentityProviderClient cognito;

    public IdentityService(
            UserAccountRepository users,
            @Value("${app.cognito.user-pool-id:}") String userPoolId,
            @Value("${app.cognito.region:us-east-1}") String region) {
        this.users = users;
        this.userPoolId = userPoolId;
        this.cognito = userPoolId.isBlank()
            ? null
            : CognitoIdentityProviderClient.builder().region(Region.of(region)).build();
    }

    /**
     * Finds or creates the account for an email: reuses the uid of an existing user with that
     * email, otherwise mints a new one, and makes sure a Cognito account exists for it. The
     * display name is refreshed on a reused Cognito account so it reflects who is being onboarded.
     */
    public Account createOrGetAccount(String email, String displayName) {
        String normalized = normalize(email);
        String uid = users.findByEmailIgnoreCase(normalized)
            .map(UserAccount::getFirebaseUid)
            .filter(u -> u != null && !u.isBlank())
            .orElseGet(() -> UUID.randomUUID().toString());
        return new Account(uid, ensureCognitoUser(normalized, displayName));
    }

    /** Sets a permanent password for the account behind an invite. Throws with a user-facing message. */
    public void setPassword(String uid, String fallbackEmail, String password) {
        String email = users.findByFirebaseUid(uid)
            .map(UserAccount::getEmail)
            .filter(e -> e != null && !e.isBlank())
            .orElse(fallbackEmail);
        if (cognito == null) {
            throw new IllegalStateException("Sign-in is not configured on this server");
        }
        String normalized = normalize(email);
        ensureCognitoUser(normalized, null);
        cognito.adminSetUserPassword(AdminSetUserPasswordRequest.builder()
            .userPoolId(userPoolId)
            .username(normalized)
            .password(password)
            .permanent(true)
            .build());
    }

    /**
     * Moves the provider account to a new email so the person can sign in with it. Returns false
     * (and changes nothing) when the new address already belongs to a different account.
     */
    public boolean changeEmail(String uid, String newEmail) {
        if (cognito == null) {
            return true;
        }
        String normalized = normalize(newEmail);
        UserAccount user = users.findByFirebaseUid(uid).orElse(null);
        try {
            if (user != null && user.getCognitoSub() != null) {
                cognito.adminUpdateUserAttributes(AdminUpdateUserAttributesRequest.builder()
                    .userPoolId(userPoolId)
                    .username(user.getCognitoSub())
                    .userAttributes(attr("email", normalized), attr("email_verified", "true"))
                    .build());
                return true;
            }
            // Never linked: nothing to move. Make sure the new address has an account.
            String sub = ensureCognitoUser(normalized, user != null ? user.getDisplayName() : null);
            if (user != null && sub != null) {
                user.setCognitoSub(sub);
                users.save(user);
            }
            return true;
        } catch (Exception e) {
            log.error("Failed to change email for uid {} to {}: {}", uid, normalized, e.getMessage());
            return false;
        }
    }

    /** True if an account with this uid exists in the current program. */
    public boolean accountKnown(String uid) {
        return uid != null && !uid.isBlank() && users.findByFirebaseUid(uid).isPresent();
    }

    private String ensureCognitoUser(String email, String displayName) {
        if (cognito == null) {
            return null;
        }
        try {
            AdminGetUserResponse existing = cognito.adminGetUser(AdminGetUserRequest.builder()
                .userPoolId(userPoolId).username(email).build());
            if (displayName != null && !displayName.isBlank()
                    && !displayName.equals(attribute(existing.userAttributes(), "name"))) {
                cognito.adminUpdateUserAttributes(AdminUpdateUserAttributesRequest.builder()
                    .userPoolId(userPoolId).username(email)
                    .userAttributes(attr("name", displayName)).build());
            }
            return attribute(existing.userAttributes(), "sub");
        } catch (UserNotFoundException notFound) {
            var created = cognito.adminCreateUser(AdminCreateUserRequest.builder()
                .userPoolId(userPoolId)
                .username(email)
                .userAttributes(
                    attr("email", email),
                    attr("email_verified", "true"),
                    attr("name", displayName == null || displayName.isBlank() ? email : displayName))
                .messageAction(MessageActionType.SUPPRESS)
                .build());
            return attribute(created.user().attributes(), "sub");
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static AttributeType attr(String name, String value) {
        return AttributeType.builder().name(name).value(value).build();
    }

    private static String attribute(List<AttributeType> attributes, String name) {
        for (AttributeType a : attributes) {
            if (name.equals(a.name())) {
                return a.value();
            }
        }
        return null;
    }
}
