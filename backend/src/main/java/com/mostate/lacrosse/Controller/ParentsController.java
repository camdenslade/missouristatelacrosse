package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Model.ParentAccount;
import com.mostate.lacrosse.Repository.ParentAccountRepository;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;

@RestController
@RequestMapping("/api/parents")
@Validated
public class ParentsController {
    private final ParentAccountRepository repository;

    public ParentsController(ParentAccountRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/{uid}")
    public ResponseEntity<ParentResponse> get(@PathVariable String uid) {
        ParentAccount parent = repository.findById(uid).orElse(null);
        if (parent == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(parent));
    }

    @PutMapping("/{uid}")
    public ResponseEntity<ParentResponse> upsert(
        @PathVariable String uid,
        @Valid @RequestBody ParentPayload payload
    ) {
        String sanitizedUid = TextSanitizer.clean(uid);
        ParentAccount parent = repository.findById(sanitizedUid).orElseGet(ParentAccount::new);
        parent.setId(sanitizedUid);
        if (payload.email() != null) {
            parent.setEmail(TextSanitizer.clean(payload.email()));
        }
        if (payload.linkedPlayers() != null) {
            parent.setLinkedPlayers(JsonUtils.toJson(TextSanitizer.cleanStringList(payload.linkedPlayers())));
        }
        ParentAccount saved = repository.save(parent);
        return ResponseEntity.ok(toResponse(saved));
    }

    private ParentResponse toResponse(ParentAccount parent) {
        List<String> linkedPlayers = JsonUtils.readList(parent.getLinkedPlayers()).stream()
            .map(String::valueOf)
            .collect(Collectors.toList());
        return new ParentResponse(
            parent.getId(),
            parent.getEmail(),
            linkedPlayers
        );
    }

    public record ParentPayload(@Email String email, List<String> linkedPlayers) {}

    public record ParentResponse(String id, String email, List<String> linkedPlayers) {}
}
