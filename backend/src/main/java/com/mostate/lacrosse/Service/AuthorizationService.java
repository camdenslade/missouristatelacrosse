package com.mostate.lacrosse.Service;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.UserAccountRepository;

/**
 * Shared role check, used by any controller that needs to verify a caller's access level
 * for a given program. Prefers the DB-backed UserAccount.roles value; falls back to the
 * Firebase token's "role" custom claim if the account lookup fails or the caller has no
 * UserAccount yet.
 *
 * Roles form a single ladder, each one including everything below it:
 * user &lt; parent &lt; alumni &lt; player &lt; board &lt; treasurer &lt; vp &lt; president &lt; admin.
 * "president" is deliberately treated as equal to "admin" for every existing isAdmin()
 * check - it is a distinct role only so officer handoffs don't require re-granting the
 * literal "admin" string - any gate that needs to be admin-only (not just president-level)
 * should check the role string directly instead of using this ladder.
 */
@Service
public class AuthorizationService {

    // Lowest to highest. "admin" is intentionally last/highest; "president" sits one rung
    // below it but passes every isAdmin()-style check since the two are meant to behave
    // identically for day-to-day permissions.
    public static final List<String> ROLE_LADDER = List.of(
        "user", "parent", "alumni", "player", "board", "treasurer", "vp", "president", "admin"
    );

    private final UserAccountRepository userRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public AuthorizationService(UserAccountRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Returns the caller's role rank: 0 = "user" (or unrecognized), higher = more access. */
    private int roleRank(String role) {
        if (role == null) return 0;
        int idx = ROLE_LADDER.indexOf(role.toLowerCase());
        return Math.max(idx, 0);
    }

    private String roleOf(String userId, String program, FirebaseToken token) {
        if (userId == null || userId.isEmpty() || program == null || program.isEmpty()) {
            return "user";
        }
        try {
            UserAccount user = userRepository.findByFirebaseUid(userId).orElse(null);
            if (user == null || user.getRoles() == null) {
                return generalRole(token);
            }
            Map<String, Object> roles = mapper.readValue(
                user.getRoles(),
                new TypeReference<Map<String, Object>>() {}
            );
            Object role = roles.get(program.toLowerCase());
            return role == null ? "user" : String.valueOf(role);
        } catch (Exception e) {
            System.err.println("Error checking role: " + e.getMessage());
            return generalRole(token);
        }
    }

    private String generalRole(FirebaseToken token) {
        if (token == null) return "user";
        Object claim = token.getClaims().get("role");
        return claim == null ? "user" : String.valueOf(claim);
    }

    /** True when the caller's role for this program is at or above the given rung. */
    public boolean hasAtLeast(String userId, String program, FirebaseToken token, String minRole) {
        return roleRank(roleOf(userId, program, token)) >= roleRank(minRole);
    }

    public boolean isAdmin(String userId, String program, FirebaseToken token) {
        // "president" passes too - see class comment.
        return hasAtLeast(userId, program, token, "president");
    }

    public boolean isBoardOrAbove(String userId, String program, FirebaseToken token) {
        return hasAtLeast(userId, program, token, "board");
    }

    public boolean isTreasurerOrAbove(String userId, String program, FirebaseToken token) {
        return hasAtLeast(userId, program, token, "treasurer");
    }

    public boolean isVpOrAbove(String userId, String program, FirebaseToken token) {
        return hasAtLeast(userId, program, token, "vp");
    }
}
