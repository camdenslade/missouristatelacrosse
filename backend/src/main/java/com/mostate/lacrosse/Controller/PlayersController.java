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
import com.google.firebase.auth.FirebaseToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.PlayerLinkService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Service.SeasonService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;

@RestController
@RequestMapping("/api/players")
@Validated
public class PlayersController {
    private static final Logger log = LoggerFactory.getLogger(PlayersController.class);

    private final PlayerRepository repository;
    private final PlayerProfileService profileService;
    private final S3Service s3Service;
    private final AuthorizationService authorizationService;
    private final SeasonService seasonService;
    private final PlayerLinkService playerLinkService;

    public PlayersController(
        PlayerRepository repository,
        PlayerProfileService profileService,
        S3Service s3Service,
        AuthorizationService authorizationService,
        SeasonService seasonService,
        PlayerLinkService playerLinkService
    ) {
        this.repository = repository;
        this.profileService = profileService;
        this.s3Service = s3Service;
        this.authorizationService = authorizationService;
        this.playerLinkService = playerLinkService;
        this.seasonService = seasonService;
    }

    @GetMapping
    public ResponseEntity<List<PlayerResponse>> list(
        HttpServletRequest request,
        @RequestParam(required = false) String season,
        @RequestParam(defaultValue = "men") String program
    ) {
        List<Player> players = (season != null && !season.isBlank())
            ? repository.findAllBySeason(season)
            : repository.findAll();
        // Each row runs its own self-heal write (autoLinkProfileAndEmail) as part of
        // toResponse() — one row with bad/conflicting data (e.g. a dangling profile link)
        // must not 500 the whole roster for every admin/parent/player. Skip and log instead.
        List<PlayerResponse> payload = players.stream()
            .map(player -> {
                try {
                    return toResponse(player, request, program);
                } catch (Exception e) {
                    log.error("Failed to build player response for {}: {}", player.getId(), e.getMessage(), e);
                    return null;
                }
            })
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toList());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlayerResponse> get(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = repository.findById(id).orElse(null);
        if (player == null) {
            List<Player> profileMatches = repository.findAllByProfileId(id);
            if (profileMatches.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            player = selectBestSeason(profileMatches);
        }
        return ResponseEntity.ok(toResponse(player, request, program));
    }

    @GetMapping("/search")
    public ResponseEntity<PlayerResponse> searchByName(
        HttpServletRequest request,
        @RequestParam String name,
        @RequestParam(required = false) String season,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (season != null && !season.isBlank()) {
            return repository.findFirstByNameIgnoreCaseAndSeason(name, season)
                .map(player -> ResponseEntity.ok(toResponse(player, request, program)))
                .orElse(ResponseEntity.notFound().build());
        }
        return repository.findFirstByNameIgnoreCase(name)
            .map(player -> ResponseEntity.ok(toResponse(player, request, program)))
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search-candidates")
    public ResponseEntity<List<PlayerResponse>> searchCandidates(
        HttpServletRequest request,
        @RequestParam String name,
        @RequestParam(defaultValue = "men") String program
    ) {
        String query = normalize(name);
        if (query.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<PlayerResponse> matches = repository.findAll().stream()
            .filter(p -> p.getName() != null && isLikelyMatch(query, normalize(p.getName())))
            .sorted(Comparator.comparingInt(p -> levenshtein(query, normalize(p.getName()))))
            .limit(5)
            .map(player -> toResponse(player, request, program))
            .collect(Collectors.toList());
        return ResponseEntity.ok(matches);
    }

    private boolean isLikelyMatch(String query, String candidate) {
        if (candidate.isEmpty()) {
            return false;
        }
        if (query.equals(candidate) || query.contains(candidate) || candidate.contains(query)) {
            return true;
        }
        String[] queryTokens = query.split(" ");
        String[] candidateTokens = candidate.split(" ");
        if (queryTokens.length > 0 && candidateTokens.length > 0) {
            String queryLast = queryTokens[queryTokens.length - 1];
            String candidateLast = candidateTokens[candidateTokens.length - 1];
            if (queryLast.equals(candidateLast) && !queryLast.isEmpty()) {
                return true;
            }
        }
        int threshold = Math.max(2, query.length() / 4);
        return levenshtein(query, candidate) <= threshold;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase().replaceAll("[^a-z0-9 ]", "").replaceAll("\\s+", " ").trim();
    }

    private int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }
        return dp[a.length()][b.length()];
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody PlayerPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Player player = new Player();
        applyPayload(player, payload);
        return ResponseEntity.ok(toResponse(repository.save(player), request, program));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody PlayerPayload payload
    ) {
        Player existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (!isAdmin(request, program) && !isSelfClaim(request, existing, payload)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        applyPayload(existing, payload);
        return ResponseEntity.ok(toResponse(repository.save(existing), request, program));
    }

    /**
     * The one legitimate non-admin write to this endpoint: a newly-logged-in player
     * claiming their own unclaimed roster row by setting userUid to themself (see
     * AuthContext.tsx's tryAutoLinkPlayer). Anything beyond that single field, or
     * claiming an already-claimed row, requires admin.
     */
    private boolean isSelfClaim(HttpServletRequest request, Player existing, PlayerPayload payload) {
        String uid = (String) request.getAttribute("firebaseUid");
        if (uid == null || uid.isBlank() || !uid.equals(payload.userUid())) {
            return false;
        }
        boolean rowUnclaimed = existing.getUserUid() == null || existing.getUserUid().isBlank();
        boolean onlyUserUidSet = payload.name() == null && payload.email() == null && payload.season() == null
            && payload.number() == null && payload.position() == null && payload.classYear() == null
            && payload.photo() == null && payload.balance() == null && payload.profileId() == null
            && payload.parents() == null && payload.data() == null;
        return rowUnclaimed && onlyUserUidSet;
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
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
            } else {
                // Profile already resolved via another path (e.g. the RosterForm fuzzy-match
                // carrying a profileId forward) — back-fill its firebaseUid too, so future
                // seasons' rows for this person can self-link via PlayerProfileService.isSelf
                // even without an explicit userUid on that row.
                profileService.setFirebaseUid(player.getProfileId(), userUid);
            }
        }
        if (payload.parents() != null) {
            String parentsJson = JsonUtils.toJson(sanitizeParents(payload.parents()));
            player.setParents(parentsJson);
            if (player.getProfileId() != null) {
                profileService.setParents(player.getProfileId(), parentsJson);
            }
        }
        if (payload.data() != null) {
            Map<String, Object> merged = new HashMap<>(JsonUtils.readMap(player.getData()));
            merged.putAll(TextSanitizer.cleanMap(payload.data()));
            player.setData(JsonUtils.toJson(merged));
        }

        // Returning player carried into a new season row with no explicit profileId yet:
        // resolve (or create) a stable, season-independent profile so their parent links
        // and payment history carry forward automatically instead of needing re-linking.
        if (player.getProfileId() == null) {
            var profile = player.getEmail() != null && !player.getEmail().isBlank()
                ? profileService.findOrCreateByEmail(player.getEmail(), player.getName())
                : null;
            if (profile == null) {
                Map<String, Object> data = JsonUtils.readMap(player.getData());
                String highSchool = data.get("highSchool") != null ? String.valueOf(data.get("highSchool")) : null;
                if (player.getName() != null && highSchool != null && !highSchool.isBlank()) {
                    profile = profileService.findOrCreateByNameAndSchool(player.getName(), highSchool);
                }
            }
            if (profile != null) {
                player.setProfileId(profile.getId());
            }
        }

        // Keep the season-independent profile's email in sync too (mirrors the parents sync
        // above) so a season rollover that doesn't happen to touch email still has it to fall
        // back to via the read-side fallback in toResponse().
        if (player.getEmail() != null && !player.getEmail().isBlank() && player.getProfileId() != null) {
            profileService.setEmail(player.getProfileId(), player.getEmail());
        }
    }

    /**
     * Public roster fields only — no email, balance, parent links, or account linkage.
     * Used for anonymous/unauthorized callers hitting the public roster read endpoints.
     */
    private PlayerResponse toResponse(Player player, HttpServletRequest request, String program) {
        return toResponse(player, isDetailAuthorized(request, player, program));
    }

    private boolean isDetailAuthorized(HttpServletRequest request, Player player, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        if (uid == null || uid.isBlank()) {
            return false;
        }
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (authorizationService.isAdmin(uid, program, token)) {
            return true;
        }
        if (profileService.isSelf(player, uid)) {
            return true;
        }
        return profileService.isLinkedParent(player, uid);
    }

    private PlayerResponse toResponse(Player player, boolean includeSensitive) {
        Map<String, Object> data = JsonUtils.readMap(player.getData());
        mergeExtraFields(data);
        java.time.Duration ttl = S3Service.IMAGE_TTL;

        if (!includeSensitive) {
            return new PlayerResponse(
                player.getId(),
                player.getName(),
                null,
                player.getSeason(),
                player.getNumber(),
                player.getPosition(),
                player.getClassYear(),
                s3Service.toPresignedUrl(player.getPhotoUrl(), ttl),
                null,
                null,
                null,
                List.of(),
                data,
                player.getCreatedAt(),
                player.getUpdatedAt()
            );
        }

        playerLinkService.autoLinkProfileAndEmail(player);

        // Prefer the season-independent profile's parent links (kept in sync across every
        // season row for this person) over the row's own field, which only reflects
        // whatever season this particular row was linked under.
        String parentsSource = player.getProfileId() != null
            ? profileService.getParents(player.getProfileId())
            : null;
        if (parentsSource == null) {
            parentsSource = player.getParents();
        }
        List<ParentLink> parents = JsonUtils.readList(
            parentsSource,
            new TypeReference<List<ParentLink>>() {}
        );

        String email = player.getEmail();

        return new PlayerResponse(
            player.getId(),
            player.getName(),
            email,
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
        return seasonService.getActiveCode();
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
