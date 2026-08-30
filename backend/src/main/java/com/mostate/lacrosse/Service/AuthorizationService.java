package com.mostate.lacrosse.Service;

import java.util.Map;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.UserAccountRepository;

/**
 * Shared admin-role check, used by any controller that needs to verify a caller
 * is an admin for a given program. Prefers the DB-backed UserAccount.roles value;
 * falls back to the Firebase token's "role" custom claim if the account lookup
 * fails or the caller has no UserAccount yet.
 */
@Service
public class AuthorizationService {

    private final UserAccountRepository userRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public AuthorizationService(UserAccountRepository userRepository) {
        this.userRepository = userRepository;
    }

    public boolean isAdmin(String userId, String program, FirebaseToken token) {
        if (userId == null || userId.isEmpty() || program == null || program.isEmpty()) {
            return false;
        }

        try {
            UserAccount user = userRepository.findByFirebaseUid(userId).orElse(null);
            if (user == null || user.getRoles() == null) {
                return isGeneralAdmin(token);
            }
            Map<String, Object> roles = mapper.readValue(
                user.getRoles(),
                new TypeReference<Map<String, Object>>() {}
            );
            Object role = roles.get(program.toLowerCase());
            return role != null && "admin".equalsIgnoreCase(String.valueOf(role));
        } catch (Exception e) {
            System.err.println("Error checking admin status: " + e.getMessage());
            return isGeneralAdmin(token);
        }
    }

    private boolean isGeneralAdmin(FirebaseToken token) {
        if (token == null) {
            return false;
        }
        Object claim = token.getClaims().get("role");
        return claim != null && "admin".equalsIgnoreCase(String.valueOf(claim));
    }
}
