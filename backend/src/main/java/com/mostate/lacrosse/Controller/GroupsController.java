package com.mostate.lacrosse.Controller;

import java.util.List;
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
import com.mostate.lacrosse.Model.Group;
import com.mostate.lacrosse.Repository.GroupRepository;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/groups")
@Validated
public class GroupsController {
    private final GroupRepository repository;

    public GroupsController(GroupRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<GroupResponse>> list() {
        List<GroupResponse> groups = repository.findAll()
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(groups);
    }

    @PostMapping
    public ResponseEntity<GroupResponse> create(@Valid @RequestBody GroupPayload payload) {
        Group group = new Group();
        group.setName(TextSanitizer.clean(payload.name()));
        group.setMembers(JsonUtils.toJson(TextSanitizer.cleanStringList(payload.members())));
        group.setCreatedBy(TextSanitizer.clean(payload.createdBy()));
        return ResponseEntity.ok(toResponse(repository.save(group)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GroupResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody GroupPayload payload
    ) {
        Group existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (payload.name() != null) {
            existing.setName(TextSanitizer.clean(payload.name()));
        }
        if (payload.members() != null) {
            existing.setMembers(JsonUtils.toJson(TextSanitizer.cleanStringList(payload.members())));
        }
        return ResponseEntity.ok(toResponse(repository.save(existing)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private GroupResponse toResponse(Group group) {
        List<String> members = JsonUtils.readList(group.getMembers()).stream()
            .map(String::valueOf)
            .collect(Collectors.toList());
        return new GroupResponse(
            group.getId(),
            group.getName(),
            members,
            group.getCreatedAt(),
            group.getUpdatedAt()
        );
    }

    public record GroupPayload(String name, List<String> members, String createdBy) {}

    public record GroupResponse(
        UUID id,
        String name,
        List<String> members,
        java.time.Instant createdAt,
        java.time.Instant updatedAt
    ) {}
}
