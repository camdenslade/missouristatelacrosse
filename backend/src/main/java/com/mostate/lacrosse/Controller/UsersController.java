package com.mostate.lacrosse.Controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;

@RestController
@RequestMapping("/api/users")
@Validated
public class UsersController {
    private final UserAccountRepository repository;
    private final PlayerRepository playerRepository;
    private final PlayerProfileService profileService;
    private final AuthorizationService authorizationService;

    public UsersController(
        UserAccountRepository repository,
        PlayerRepository playerRepository,
        PlayerProfileService profileService,
        AuthorizationService authorizationService
    ) {
        this.repository = repository;
        this.playerRepository = playerRepository;
        this.profileService = profileService;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    public ResponseEntity<?> list(
        HttpServletRequest request,
        @RequestParam(required = false) String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        List<UserAccount> users = repository.findAllByOrderByDisplayNameAsc();
        String sanitizedProgram = TextSanitizer.clean(program);
        if (sanitizedProgram != null && !sanitizedProgram.isBlank()) {
            String normalized = sanitizedProgram.trim().toLowerCase();
            users = users.stream()
                .filter(user -> hasProgram(user, normalized))
                .collect(Collectors.toList());
        }
        List<UserResponse> payload = users.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/{uid}")
    public ResponseEntity<?> getByUid(
        HttpServletRequest request,
        @PathVariable String uid,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isSelfOrAdmin(request, uid, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        UserAccount user = repository.findByFirebaseUid(uid).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(user));
    }

    /**
     * Fuzzy last-name search for the "suggested matches" UI on the parent-linking forms
     * (Payments page — both the invite-new and link-existing flows). Deliberately NOT
     * admin-only: players use this too, when adding their own parent. Excludes admin-role
     * accounts from results so this can't be used to enumerate admin identities/emails via
     * fuzzy search from a non-admin caller; every other role is fair game since the whole
     * point is surfacing an existing account (parent, user, alumni, etc.) that might already
     * belong to this player's parent.
     */
    @GetMapping("/search-candidates")
    public ResponseEntity<?> searchCandidates(
        HttpServletRequest request,
        @RequestParam String lastName,
        @RequestParam(defaultValue = "men") String program,
        @RequestParam(required = false) String excludeUid
    ) {
        String uid = (String) request.getAttribute("firebaseUid");
        if (uid == null || uid.isBlank()) {
            return ResponseEntity.status(401).body(new ErrorResponse("Authentication required"));
        }
        String query = TextSanitizer.clean(lastName);
        if (query == null || query.trim().length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        String normalizedQuery = query.trim().toLowerCase();
        String normalizedProgram = program.trim().toLowerCase();
        String normalizedExcludeUid = TextSanitizer.clean(excludeUid);

        List<CandidateResponse> payload = repository.findAllByOrderByDisplayNameAsc().stream()
            .filter(u -> u.getDisplayName() != null && u.getDisplayName().toLowerCase().contains(normalizedQuery))
            // Never suggest the player's own account as a candidate "parent" for themself.
            .filter(u -> normalizedExcludeUid == null || normalizedExcludeUid.isBlank()
                || !normalizedExcludeUid.equals(u.getFirebaseUid()))
            .filter(u -> !"admin".equalsIgnoreCase(
                String.valueOf(JsonUtils.readMap(u.getRoles()).getOrDefault(normalizedProgram, ""))
            ))
            .limit(8)
            .map(u -> new CandidateResponse(u.getFirebaseUid(), u.getDisplayName(), u.getEmail()))
            .collect(Collectors.toList());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/by-email")
    public ResponseEntity<?> getByEmail(
        HttpServletRequest request,
        @RequestParam String email,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        UserAccount user = repository.findFirstByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(user));
    }

    @GetMapping("/by-player/{playerId}")
    public ResponseEntity<?> getByPlayer(
        HttpServletRequest request,
        @PathVariable UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        UserAccount user = repository.findFirstByPlayerId(playerId).orElse(null);
        if (user == null) {
            // playerId stores the profile UUID; fall back to player.userUid -> firebaseUid lookup
            Player player = playerRepository.findById(playerId).orElse(null);
            if (player != null && player.getUserUid() != null && !player.getUserUid().isBlank()) {
                user = repository.findByFirebaseUid(player.getUserUid()).orElse(null);
            }
        }
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(user));
    }

    @PutMapping("/{uid}")
    public ResponseEntity<?> upsert(
        HttpServletRequest request,
        @PathVariable String uid,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody UserPayload payload
    ) {
        boolean callerIsAdmin = isAdmin(request, program);
        if (!callerIsAdmin && !isSelf(request, uid)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        }
        // Self-service accounts (first login, profile edits, auto-link) are allowed to touch
        // roles/programs — but never to grant themselves admin. Only an existing admin may
        // promote anyone to admin.
        if (!callerIsAdmin && payload.roles() != null
                && payload.roles().values().stream().anyMatch(v -> "admin".equalsIgnoreCase(String.valueOf(v)))) {
            return ResponseEntity.status(403).body(new ErrorResponse("Cannot self-assign admin role"));
        }

        String sanitizedUid = TextSanitizer.clean(uid);
        UserAccount user = repository.findByFirebaseUid(sanitizedUid).orElseGet(UserAccount::new);
        user.setFirebaseUid(sanitizedUid);
        if (payload.email() != null) {
            user.setEmail(TextSanitizer.clean(payload.email()));
        }
        if (payload.displayName() != null) {
            user.setDisplayName(TextSanitizer.clean(payload.displayName()));
        }
        if (payload.roles() != null) {
            Map<String, Object> merged = new HashMap<>(JsonUtils.readMap(user.getRoles()));
            merged.putAll(TextSanitizer.cleanMap(payload.roles()));
            user.setRoles(JsonUtils.toJson(merged));
        }
        if (payload.programs() != null) {
            user.setPrograms(JsonUtils.toJson(TextSanitizer.cleanStringList(payload.programs())));
        }
        if (payload.playerId() != null) {
            user.setPlayerId(resolveProfileId(payload.playerId(), sanitizedUid));
        }

        UserAccount saved = repository.save(user);
        return ResponseEntity.ok(toResponse(saved));
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable String uid,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        String sanitizedUid = TextSanitizer.clean(uid);
        if (sanitizedUid == null || sanitizedUid.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        UserAccount user = repository.findByFirebaseUid(sanitizedUid).orElse(null);
        if (user == null) {
            try {
                UUID id = UUID.fromString(sanitizedUid);
                user = repository.findById(id).orElse(null);
            } catch (IllegalArgumentException ignored) {
                return ResponseEntity.notFound().build();
            }
        }

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        repository.delete(user);
        return ResponseEntity.noContent().build();
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    private boolean isSelf(HttpServletRequest request, String pathUid) {
        String uid = (String) request.getAttribute("firebaseUid");
        return uid != null && uid.equals(pathUid);
    }

    private boolean isSelfOrAdmin(HttpServletRequest request, String pathUid, String program) {
        return isSelf(request, pathUid) || isAdmin(request, program);
    }

    private UserResponse toResponse(UserAccount user) {
        return new UserResponse(
            user.getId(),
            user.getFirebaseUid(),
            user.getEmail(),
            user.getDisplayName(),
            JsonUtils.readMap(user.getRoles()),
            JsonUtils.readList(user.getPrograms()).stream()
                .map(String::valueOf)
                .collect(Collectors.toList()),
            user.getPlayerId() != null ? user.getPlayerId().toString() : null
        );
    }

    private boolean hasProgram(UserAccount user, String program) {
        Map<String, Object> roles = JsonUtils.readMap(user.getRoles());
        if (roles.containsKey(program)) {
            return true;
        }
        return JsonUtils.readList(user.getPrograms()).stream()
            .anyMatch(item -> program.equalsIgnoreCase(String.valueOf(item)));
    }

    private UUID resolveProfileId(UUID playerOrProfileId, String firebaseUid) {
        var profile = profileService.findById(playerOrProfileId);
        if (profile != null) {
            return profile.getId();
        }
        Player player = playerRepository.findById(playerOrProfileId).orElse(null);
        if (player == null) {
            return playerOrProfileId;
        }
        if (player.getProfileId() != null) {
            return player.getProfileId();
        }
        var created = profileService.findOrCreateByFirebaseUid(firebaseUid, player.getName(), player.getEmail());
        if (created != null) {
            player.setProfileId(created.getId());
            player.setUserUid(firebaseUid);
            playerRepository.save(player);
            return created.getId();
        }
        return playerOrProfileId;
    }

    public record UserPayload(
        @Email String email,
        String displayName,
        Map<String, Object> roles,
        List<String> programs,
        UUID playerId
    ) {}

    public record CandidateResponse(String uid, String displayName, String email) {}

    public record UserResponse(
        UUID id,
        String uid,
        String email,
        String displayName,
        Map<String, Object> roles,
        List<String> programs,
        String playerId
    ) {}
}
