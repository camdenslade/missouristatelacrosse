package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Comparator;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.core.type.TypeReference;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;

@RestController
@RequestMapping("/api/players")
@Validated
public class PlayersController {
    private final PlayerRepository repository;
    private final PlayerProfileService profileService;
    private final S3Service s3Service;

    public PlayersController(
        PlayerRepository repository,
        PlayerProfileService profileService,
        S3Service s3Service
    ) {
        this.repository = repository;
        this.profileService = profileService;
        this.s3Service = s3Service;
    }

    @GetMapping
    public ResponseEntity<List<PlayerResponse>> list(@RequestParam(required = false) String season) {
        List<Player> players = (season != null && !season.isBlank())
            ? repository.findAllBySeason(season)
            : repository.findAll();
        List<PlayerResponse> payload = players.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlayerResponse> get(@PathVariable UUID id) {
        Player player = repository.findById(id).orElse(null);
        if (player == null) {
            List<Player> profileMatches = repository.findAllByProfileId(id);
            if (profileMatches.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            player = selectBestSeason(profileMatches);
        }
        return ResponseEntity.ok(toResponse(player));
    }

    @GetMapping("/search")
    public ResponseEntity<PlayerResponse> searchByName(
        @RequestParam String name,
        @RequestParam(required = false) String season
    ) {
        if (season != null && !season.isBlank()) {
            return repository.findFirstByNameIgnoreCaseAndSeason(name, season)
                .map(player -> ResponseEntity.ok(toResponse(player)))
                .orElse(ResponseEntity.notFound().build());
        }
        return repository.findFirstByNameIgnoreCase(name)
            .map(player -> ResponseEntity.ok(toResponse(player)))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<PlayerResponse> create(@Valid @RequestBody PlayerPayload payload) {
        Player player = new Player();
        applyPayload(player, payload);
        return ResponseEntity.ok(toResponse(repository.save(player)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlayerResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody PlayerPayload payload
    ) {
        Player existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        applyPayload(existing, payload);
        return ResponseEntity.ok(toResponse(repository.save(existing)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void applyPayload(Player player, PlayerPayload payload) {
        String name = TextSanitizer.clean(payload.name());
        if (name != null) {
            player.setName(name);
        }
        String email = TextSanitizer.clean(payload.email());
        if (email != null) {
            player.setEmail(email);
        }
        String season = TextSanitizer.clean(payload.season());
        if (season != null) {
            player.setSeason(season);
        }
        String number = TextSanitizer.clean(payload.number());
        if (number != null) {
            player.setNumber(number);
        }
        String position = TextSanitizer.clean(payload.position());
        if (position != null) {
            player.setPosition(position);
        }
        String classYear = TextSanitizer.clean(payload.classYear());
        if (classYear != null) {
            player.setClassYear(classYear);
        }
        String photo = TextSanitizer.clean(payload.photo());
        if (photo != null) {
            player.setPhotoUrl(photo);
        }
        if (payload.balance() != null) {
            player.setBalance(payload.balance());
        }
        if (payload.profileId() != null) {
            player.setProfileId(payload.profileId());
        }
        String userUid = TextSanitizer.clean(payload.userUid());
        if (userUid != null) {
            player.setUserUid(userUid);
            if (player.getProfileId() == null) {
                var profile = profileService.findOrCreateByFirebaseUid(
                    userUid,
                    name != null ? name : player.getName(),
                    email != null ? email : player.getEmail()
                );
                if (profile != null) {
                    player.setProfileId(profile.getId());
                }
            }
        }
        if (payload.parents() != null) {
            player.setParents(JsonUtils.toJson(sanitizeParents(payload.parents())));
        }
        if (payload.data() != null) {
            Map<String, Object> merged = new HashMap<>(JsonUtils.readMap(player.getData()));
            merged.putAll(TextSanitizer.cleanMap(payload.data()));
            player.setData(JsonUtils.toJson(merged));
        }
    }

    private PlayerResponse toResponse(Player player) {
        Map<String, Object> data = JsonUtils.readMap(player.getData());
        mergeExtraFields(data);
        List<ParentLink> parents = JsonUtils.readList(
            player.getParents(),
            new TypeReference<List<ParentLink>>() {}
        );
        java.time.Duration ttl = java.time.Duration.ofMinutes(15);
        return new PlayerResponse(
            player.getId(),
            player.getName(),
            player.getEmail(),
            player.getSeason(),
            player.getNumber(),
            player.getPosition(),
            player.getClassYear(),
            s3Service.toPresignedUrl(player.getPhotoUrl(), ttl),
            player.getBalance(),
            player.getProfileId(),
            player.getUserUid(),
            parents,
            data,
            player.getCreatedAt(),
            player.getUpdatedAt()
        );
    }

    private Player selectBestSeason(List<Player> players) {
        String currentSeason = currentSeason();
        return players.stream()
            .filter(player -> currentSeason.equals(player.getSeason()))
            .findFirst()
            .orElseGet(() -> players.stream()
                .max(Comparator.comparingInt(player -> parseSeasonStart(player.getSeason())))
                .orElse(players.get(0)));
    }

    private String currentSeason() {
        java.time.LocalDate now = java.time.LocalDate.now();
        int year = now.getYear();
        int start = now.getMonthValue() >= 8 ? year : year - 1;
        return String.format("%02d-%02d", start % 100, (start + 1) % 100);
    }

    private int parseSeasonStart(String season) {
        if (season == null || season.length() < 2) {
            return -1;
        }
        String[] parts = season.split("-");
        if (parts.length < 1) {
            return -1;
        }
        try {
            int startYear = Integer.parseInt(parts[0]);
            return startYear;
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private void mergeExtraFields(Map<String, Object> data) {
        if (data == null) {
            return;
        }
        data.putIfAbsent("height", "");
        data.putIfAbsent("weight", "");
        data.putIfAbsent("hometown", "");
        data.putIfAbsent("state", "");
        data.putIfAbsent("highSchool", "");
        data.putIfAbsent("previousSchool", "");
        data.putIfAbsent("bio", "");
        data.putIfAbsent("userID", "");
    }

    private List<ParentLink> sanitizeParents(List<ParentLink> parents) {
        return parents.stream()
            .map(parent -> new ParentLink(
                TextSanitizer.clean(parent.uid()),
                TextSanitizer.clean(parent.email())
            ))
            .collect(Collectors.toList());
    }


    public record PlayerPayload(
        String name,
        @Email String email,
        String season,
        String number,
        String position,
        String classYear,
        String photo,
        BigDecimal balance,
        UUID profileId,
        String userUid,
        List<ParentLink> parents,
        Map<String, Object> data
    ) {}

    public record ParentLink(String uid, String email) {}

    public record PlayerResponse(
        UUID id,
        String name,
        String email,
        String season,
        String number,
        String position,
        String classYear,
        String photo,
        BigDecimal balance,
        UUID profileId,
        String userUid,
        List<ParentLink> parents,
        Map<String, Object> data,
        java.time.Instant createdAt,
        java.time.Instant updatedAt
    ) {}
}
