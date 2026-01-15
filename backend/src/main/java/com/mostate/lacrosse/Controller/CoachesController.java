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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Model.Coach;
import com.mostate.lacrosse.Repository.CoachRepository;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/coaches")
@Validated
public class CoachesController {
    private final CoachRepository repository;
    private final S3Service s3Service;

    public CoachesController(CoachRepository repository, S3Service s3Service) {
        this.repository = repository;
        this.s3Service = s3Service;
    }

    @GetMapping
    public ResponseEntity<List<CoachResponse>> list() {
        List<CoachResponse> payload = repository.findAll()
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(payload);
    }

    @PostMapping
    public ResponseEntity<CoachResponse> create(@Valid @RequestBody CoachPayload payload) {
        Coach coach = new Coach();
        applyPayload(coach, payload);
        return ResponseEntity.ok(toResponse(repository.save(coach)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CoachResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody CoachPayload payload
    ) {
        Coach existing = repository.findById(id).orElse(null);
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

    private void applyPayload(Coach coach, CoachPayload payload) {
        String name = TextSanitizer.clean(payload.name());
        if (name != null) {
            coach.setName(name);
        }
        String position = TextSanitizer.clean(payload.position());
        String title = TextSanitizer.clean(payload.title());
        if (position != null) {
            coach.setTitle(position);
        } else if (title != null) {
            coach.setTitle(title);
        }
        String photo = TextSanitizer.clean(payload.photo());
        if (photo != null) {
            coach.setPhotoUrl(photo);
        }
        String season = TextSanitizer.clean(payload.season());
        if (season != null) {
            coach.setSeason(season);
        }
        if (payload.data() != null) {
            Map<String, Object> merged = new HashMap<>(JsonUtils.readMap(coach.getData()));
            merged.putAll(TextSanitizer.cleanMap(payload.data()));
            coach.setData(JsonUtils.toJson(merged));
        }
    }

    private CoachResponse toResponse(Coach coach) {
        Map<String, Object> data = JsonUtils.readMap(coach.getData());
        mergeExtraFields(data);
        java.time.Duration ttl = java.time.Duration.ofMinutes(15);
        return new CoachResponse(
            coach.getId(),
            coach.getName(),
            coach.getTitle(),
            s3Service.toPresignedUrl(coach.getPhotoUrl(), ttl),
            coach.getSeason(),
            data,
            coach.getCreatedAt(),
            coach.getUpdatedAt()
        );
    }

    private void mergeExtraFields(Map<String, Object> data) {
        if (data == null) {
            return;
        }
        data.putIfAbsent("bio", "");
    }


    public record CoachPayload(
        String name,
        String position,
        String title,
        String photo,
        String season,
        Map<String, Object> data
    ) {}

    public record CoachResponse(
        UUID id,
        String name,
        String position,
        String photo,
        String season,
        Map<String, Object> data,
        java.time.Instant createdAt,
        java.time.Instant updatedAt
    ) {}
}
