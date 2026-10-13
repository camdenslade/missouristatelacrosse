package com.mostate.lacrosse.Controller;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Game;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.GameRepository;
import com.mostate.lacrosse.Repository.TeamRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import com.mostate.lacrosse.Model.Team;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/games")
public class GamesController {
    private final GameRepository gameRepository;
    private final TeamRepository teamRepository;
    private final UserAccountRepository userRepository;
    private final S3Service s3Service;
    private final SimpMessagingTemplate broker;
    private final AuthorizationService authorizationService;

    public GamesController(
        GameRepository gameRepository,
        TeamRepository teamRepository,
        UserAccountRepository userRepository,
        S3Service s3Service,
        SimpMessagingTemplate broker,
        AuthorizationService authorizationService
    ) {
        this.gameRepository = gameRepository;
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
        this.broker = broker;
        this.authorizationService = authorizationService;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    // Score/box-score editing is open to any player/parent/alumni account (and everyone
    // above them in the ladder) so parents can keep a live score current - see update().
    private boolean isScoreEditor(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.hasAtLeast(uid, program, token, "parent");
    }

    private String currentUid(HttpServletRequest request) {
        return (String) request.getAttribute("firebaseUid");
    }

    @GetMapping
    public ResponseEntity<List<GameResponse>> list() {
        java.time.Duration ttl = S3Service.IMAGE_TTL;
        return ResponseEntity.ok(gameRepository.findAllByOrderByDateAsc().stream()
            .map(game -> toResponse(game, ttl))
            .toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GameResponse> get(@PathVariable UUID id) {
        return gameRepository.findById(id)
            .map(game -> ResponseEntity.ok(toResponse(game, S3Service.IMAGE_TTL)))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest request, @RequestBody GamePayload payload) {
        if (!isAdmin(request, TenantContext.getTenant())) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Game game = new Game();
        applyPayload(game, payload);
        Game saved = gameRepository.save(game);
        syncTeamFromGame(saved);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(HttpServletRequest request, @PathVariable UUID id, @RequestBody GamePayload payload) {
        String program = TenantContext.getTenant();
        boolean admin = isAdmin(request, program);
        if (!admin && !isScoreEditor(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Game existing = gameRepository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        GamePayload effectivePayload = payload;
        if (!admin) {
            // Non-admin score editors (player/parent/alumni and up) can only touch the
            // score/box-score/clock - never roster fields, and never stats unless they're
            // specifically the assigned stats-enterer for this game.
            String assignedUid = (String) JsonUtils.readMap(existing.getData()).get("statsAssigneeUid");
            boolean canEditStats = assignedUid != null && assignedUid.equals(currentUid(request));
            Map<String, Object> allowedData = payload.data() != null
                ? new HashMap<>(payload.data())
                : new HashMap<>();
            if (!canEditStats) {
                allowedData.remove("stats");
                allowedData.remove("playerStats");
            }
            // Only these keys are ever accepted from a non-admin caller.
            allowedData.keySet().retainAll(java.util.Set.of(
                "msuScore", "oppScore", "boxScore", "currentQuarter", "timeInQuarter",
                "stats", "playerStats", "status"
            ));
            effectivePayload = new GamePayload(
                null, null, null, null, null, null, null, allowedData
            );
        }

        applyPayload(existing, effectivePayload);
        Game saved = gameRepository.save(existing);
        syncTeamFromGame(saved);
        GameResponse response = toResponse(saved, S3Service.IMAGE_TTL);
        // Broadcast live update so viewers don't have to poll
        if (program != null) {
            broker.convertAndSend("/topic/game/" + program + "/" + id, response);
        }
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(HttpServletRequest request, @PathVariable UUID id) {
        if (!isAdmin(request, TenantContext.getTenant())) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        gameRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Lets an admin hand off live stats entry for this game to a specific account (by
     * email) - that person (and admins) can then fill in player stats; everyone else with
     * score-edit access still only touches the score/box-score. Pass an empty/blank email
     * to un-assign.
     */
    @PutMapping("/{id}/stats-assignee")
    public ResponseEntity<?> setStatsAssignee(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestBody StatsAssigneeRequest body
    ) {
        String program = TenantContext.getTenant();
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Game existing = gameRepository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> data = new HashMap<>(JsonUtils.readMap(existing.getData()));
        String email = body.email() != null ? body.email().trim() : "";
        if (email.isEmpty()) {
            data.remove("statsAssigneeUid");
            data.remove("statsAssigneeEmail");
        } else {
            UserAccount assignee = userRepository.findByEmailIgnoreCase(email).orElse(null);
            if (assignee == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("No account found for that email"));
            }
            data.put("statsAssigneeUid", assignee.getFirebaseUid());
            data.put("statsAssigneeEmail", email.toLowerCase());
        }
        existing.setData(JsonUtils.toJson(data));
        Game saved = gameRepository.save(existing);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    public record StatsAssigneeRequest(String email) {}

    private void applyPayload(Game game, GamePayload payload) {
        String opponent = TextSanitizer.clean(payload.opponent());
        if (opponent != null) {
            game.setOpponent(opponent);
        }
        if (payload.date() != null) {
            game.setDate(payload.date());
        }
        String time = TextSanitizer.clean(payload.time());
        if (time != null) {
            game.setTime(time);
        }
        String location = TextSanitizer.clean(payload.location());
        if (location != null) {
            game.setLocation(location);
        }
        String awayLogo = TextSanitizer.clean(payload.awayLogo());
        if (awayLogo != null) {
            game.setAwayLogo(awayLogo);
        }
        String awayLink = TextSanitizer.clean(payload.awayLink());
        if (awayLink != null) {
            game.setAwayLink(awayLink);
        }
        String season = TextSanitizer.clean(payload.season());
        if (season != null) {
            game.setSeason(season);
        }
        if (payload.data() != null) {
            Map<String, Object> merged = new HashMap<>(JsonUtils.readMap(game.getData()));
            merged.putAll(TextSanitizer.cleanMap(payload.data()));
            game.setData(JsonUtils.toJson(merged));
        }
    }

    private void syncTeamFromGame(Game game) {
        if (game.getOpponent() == null || game.getOpponent().isBlank()) {
            return;
        }
        Team team = teamRepository.findFirstByNameIgnoreCase(game.getOpponent())
            .orElseGet(Team::new);
        team.setName(game.getOpponent());
        team.setLogoUrl(game.getAwayLogo());
        team.setLink(game.getAwayLink());
        teamRepository.save(team);
    }

    private GameResponse toResponse(Game game, java.time.Duration ttl) {
        return new GameResponse(
            game.getId(),
            game.getOpponent(),
            game.getDate(),
            game.getTime(),
            game.getLocation(),
            s3Service.toPresignedUrl(game.getAwayLogo(), ttl),
            game.getAwayLink(),
            game.getSeason(),
            game.getData(),
            game.getCreatedAt(),
            game.getUpdatedAt()
        );
    }

    public record GamePayload(
        String opponent,
        Instant date,
        String time,
        String location,
        String awayLogo,
        String awayLink,
        String season,
        Map<String, Object> data
    ) {}

    public record GameResponse(
        UUID id,
        String opponent,
        Instant date,
        String time,
        String location,
        String awayLogo,
        String awayLink,
        String season,
        String data,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
