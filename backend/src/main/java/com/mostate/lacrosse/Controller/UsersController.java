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
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;

@RestController
@RequestMapping("/api/users")
@Validated
public class UsersController {
    private final UserAccountRepository repository;
    private final PlayerRepository playerRepository;
    private final PlayerProfileService profileService;

    public UsersController(
        UserAccountRepository repository,
        PlayerRepository playerRepository,
        PlayerProfileService profileService
    ) {
        this.repository = repository;
        this.playerRepository = playerRepository;
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> list(@RequestParam(required = false) String program) {
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
    public ResponseEntity<UserResponse> getByUid(@PathVariable String uid) {
        UserAccount user = repository.findByFirebaseUid(uid).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(user));
    }

    @GetMapping("/by-email")
    public ResponseEntity<UserResponse> getByEmail(@RequestParam String email) {
        UserAccount user = repository.findFirstByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(user));
    }

    @GetMapping("/by-player/{playerId}")
    public ResponseEntity<UserResponse> getByPlayer(@PathVariable UUID playerId) {
        UserAccount user = repository.findFirstByPlayerId(playerId).orElse(null);
        if (user == null) {
            // playerId stores the profile UUID; fall back to player.userUid → firebaseUid lookup
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
    public ResponseEntity<UserResponse> upsert(
        @PathVariable String uid,
        @Valid @RequestBody UserPayload payload
    ) {
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
    public ResponseEntity<Void> delete(@PathVariable String uid) {
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
