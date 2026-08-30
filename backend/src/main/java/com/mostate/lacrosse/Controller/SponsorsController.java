package com.mostate.lacrosse.Controller;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
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
import com.mostate.lacrosse.Model.Sponsor;
import com.mostate.lacrosse.Repository.SponsorRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/sponsors")
public class SponsorsController {
    private final SponsorRepository repository;
    private final S3Service s3Service;
    private final AuthorizationService authorizationService;

    public SponsorsController(SponsorRepository repository, S3Service s3Service, AuthorizationService authorizationService) {
        this.repository = repository;
        this.s3Service = s3Service;
        this.authorizationService = authorizationService;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    @GetMapping
    public ResponseEntity<List<SponsorResponse>> list() {
        Duration ttl = S3Service.IMAGE_TTL;
        return ResponseEntity.ok(
            repository.findAllByOrderByDisplayOrderAsc().stream()
                .map(s -> toResponse(s, ttl))
                .toList()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<SponsorResponse> get(@PathVariable UUID id) {
        return repository.findById(id)
            .map(s -> ResponseEntity.ok(toResponse(s, S3Service.IMAGE_TTL)))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody SponsorPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Sponsor sponsor = new Sponsor();
        applyPayload(sponsor, payload);
        Sponsor saved = repository.save(sponsor);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody SponsorPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Sponsor existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        applyPayload(existing, payload);
        Sponsor saved = repository.save(existing);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
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

    private void applyPayload(Sponsor sponsor, SponsorPayload payload) {
        if (payload.name() != null) {
            sponsor.setName(TextSanitizer.clean(payload.name()));
        }
        if (payload.logo() != null) {
            sponsor.setLogo(payload.logo());
        }
        if (payload.link() != null) {
            sponsor.setLink(TextSanitizer.clean(payload.link()));
        }
        if (payload.displayOrder() != null) {
            sponsor.setDisplayOrder(payload.displayOrder());
        }
    }

    private SponsorResponse toResponse(Sponsor sponsor, Duration ttl) {
        return new SponsorResponse(
            sponsor.getId(),
            sponsor.getName(),
            s3Service.toPresignedUrl(sponsor.getLogo(), ttl),
            sponsor.getLink(),
            sponsor.getDisplayOrder(),
            sponsor.getCreatedAt(),
            sponsor.getUpdatedAt()
        );
    }

    public record SponsorPayload(
        String name,
        String logo,
        String link,
        Integer displayOrder
    ) {}

    public record SponsorResponse(
        UUID id,
        String name,
        String logo,
        String link,
        int displayOrder,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
