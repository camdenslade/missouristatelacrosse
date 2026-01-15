package com.mostate.lacrosse.Controller;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
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

    public GamesController(
        GameRepository gameRepository,
        TeamRepository teamRepository,
        S3Service s3Service
    ) {
        this.gameRepository = gameRepository;
        this.teamRepository = teamRepository;
        this.s3Service = s3Service;
    }

    @GetMapping
    public ResponseEntity<List<GameResponse>> list() {
        java.time.Duration ttl = java.time.Duration.ofMinutes(15);
        return ResponseEntity.ok(gameRepository.findAllByOrderByDateAsc().stream()
            .map(game -> toResponse(game, ttl))
            .toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GameResponse> get(@PathVariable UUID id) {
        return gameRepository.findById(id)
            .map(game -> ResponseEntity.ok(toResponse(game, java.time.Duration.ofMinutes(15))))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<GameResponse> create(@RequestBody GamePayload payload) {
        Game game = new Game();
        applyPayload(game, payload);
        Game saved = gameRepository.save(game);
        syncTeamFromGame(saved);
        return ResponseEntity.ok(toResponse(saved, java.time.Duration.ofMinutes(15)));
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
        return ResponseEntity.ok(toResponse(saved, java.time.Duration.ofMinutes(15)));
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
