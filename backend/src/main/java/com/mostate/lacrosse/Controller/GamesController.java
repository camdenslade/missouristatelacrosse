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
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Model.Game;
import com.mostate.lacrosse.Repository.GameRepository;
import com.mostate.lacrosse.Repository.TeamRepository;
import com.mostate.lacrosse.Model.Team;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/games")
public class GamesController {
    private final GameRepository gameRepository;
    private final TeamRepository teamRepository;
    private final S3Service s3Service;
    private final SimpMessagingTemplate broker;

    public GamesController(
        GameRepository gameRepository,
        TeamRepository teamRepository,
        S3Service s3Service,
        SimpMessagingTemplate broker
    ) {
        this.gameRepository = gameRepository;
        this.teamRepository = teamRepository;
        this.s3Service = s3Service;
        this.broker = broker;
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
    public ResponseEntity<GameResponse> create(@RequestBody GamePayload payload) {
        Game game = new Game();
        applyPayload(game, payload);
        Game saved = gameRepository.save(game);
        syncTeamFromGame(saved);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GameResponse> update(@PathVariable UUID id, @RequestBody GamePayload payload) {
        Game existing = gameRepository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        applyPayload(existing, payload);
        Game saved = gameRepository.save(existing);
        syncTeamFromGame(saved);
        GameResponse response = toResponse(saved, S3Service.IMAGE_TTL);
        // Broadcast live update so viewers don't have to poll
        String program = TenantContext.getTenant();
        if (program != null) {
            broker.convertAndSend("/topic/game/" + program + "/" + id, response);
        }
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        gameRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

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
