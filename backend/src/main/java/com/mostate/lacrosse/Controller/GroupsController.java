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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Group;
import com.mostate.lacrosse.Repository.GroupRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/groups")
@Validated
public class GroupsController {
    private final GroupRepository repository;
    private final AuthorizationService authorizationService;

    public GroupsController(GroupRepository repository, AuthorizationService authorizationService) {
        this.repository = repository;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    public ResponseEntity<?> list(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        List<GroupResponse> groups = repository.findAll()
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(groups);
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody GroupPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Group group = new Group();
        group.setName(TextSanitizer.clean(payload.name()));
        group.setMembers(JsonUtils.toJson(TextSanitizer.cleanStringList(payload.members())));
        group.setCreatedBy(TextSanitizer.clean(payload.createdBy()));
        return ResponseEntity.ok(toResponse(repository.save(group)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @PathVariable UUID id,
        @Valid @RequestBody GroupPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
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
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @PathVariable UUID id
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
