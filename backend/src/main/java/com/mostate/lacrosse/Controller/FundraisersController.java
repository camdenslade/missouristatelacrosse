package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
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
import com.mostate.lacrosse.Model.Fundraiser;
import com.mostate.lacrosse.Repository.FundraiserRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/fundraisers")
public class FundraisersController {
    private final FundraiserRepository repository;
    private final AuthorizationService authorizationService;
    private final S3Service s3Service;

    private static final java.time.Duration IMAGE_TTL = S3Service.IMAGE_TTL;

    public FundraisersController(
        FundraiserRepository repository,
        AuthorizationService authorizationService,
        S3Service s3Service
    ) {
        this.repository = repository;
        this.authorizationService = authorizationService;
        this.s3Service = s3Service;
    }

    // Public: list published campaigns, active-first then newest
    @GetMapping
    public ResponseEntity<List<FundraiserResponse>> list() {
        return ResponseEntity.ok(
            repository.findByPublishedTrueOrderByActiveDescCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList()
        );
    }

    // Public: get a published campaign by slug
    @GetMapping("/slug/{slug}")
    public ResponseEntity<FundraiserResponse> getBySlug(@PathVariable String slug) {
        return repository.findBySlugAndPublishedTrue(slug)
            .map(f -> ResponseEntity.ok(toResponse(f)))
            .orElse(ResponseEntity.notFound().build());
    }

    // Admin: list all campaigns regardless of published state
    @GetMapping("/admin")
    public ResponseEntity<?> listAll(HttpServletRequest request, @RequestParam(defaultValue = "men") String program) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        return ResponseEntity.ok(
            repository.findAllByOrderByActiveDescCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList()
        );
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody FundraiserPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Fundraiser fundraiser = new Fundraiser();
        fundraiser.setProgram(program);
        fundraiser.setSlug(UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        applyPayload(fundraiser, payload);
        if (fundraiser.isActive()) {
            deactivateOthers(null);
        }
        return ResponseEntity.ok(toResponse(repository.save(fundraiser)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody FundraiserPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Fundraiser existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        applyPayload(existing, payload);
        if (existing.isActive()) {
            deactivateOthers(id);
        }
        return ResponseEntity.ok(toResponse(repository.save(existing)));
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

    // Only one fundraiser can be "active" (featured in the homepage banner) at a time.
    private void deactivateOthers(UUID exceptId) {
        List<Fundraiser> active = repository.findAll().stream()
            .filter(Fundraiser::isActive)
            .filter(f -> exceptId == null || !f.getId().equals(exceptId))
            .toList();
        for (Fundraiser f : active) {
            f.setActive(false);
            repository.save(f);
        }
    }

    private void applyPayload(Fundraiser fundraiser, FundraiserPayload payload) {
        if (payload.title() != null) {
            fundraiser.setTitle(TextSanitizer.clean(payload.title()));
        }
        if (payload.description() != null) {
            fundraiser.setDescription(payload.description().isBlank() ? null : TextSanitizer.clean(payload.description()));
        }
        if (payload.image() != null) {
            fundraiser.setImage(payload.image().isBlank() ? null : payload.image());
        }
        if (payload.link() != null) {
            fundraiser.setLink(payload.link().isBlank() ? null : TextSanitizer.clean(payload.link()));
        }
        if (payload.goalAmount() != null) {
            fundraiser.setGoalAmount(payload.goalAmount());
        }
        if (payload.expenses() != null) {
            fundraiser.setExpenses(payload.expenses());
        }
        if (payload.active() != null) {
            fundraiser.setActive(payload.active());
        }
        if (payload.published() != null) {
            fundraiser.setPublished(payload.published());
        }
    }

    private FundraiserResponse toResponse(Fundraiser f) {
        return new FundraiserResponse(
            f.getId(), f.getTitle(), f.getSlug(), f.getDescription(),
            s3Service.toPresignedUrl(f.getImage(), IMAGE_TTL),
            f.getLink(), f.getGoalAmount(), f.getExpenses(),
            f.isActive(), f.isPublished(), f.getProgram(),
            f.getCreatedAt(), f.getUpdatedAt()
        );
    }

    public record FundraiserPayload(
        String title,
        String description,
        String image,
        String link,
        BigDecimal goalAmount,
        String expenses,
        Boolean active,
        Boolean published
    ) {}

    public record FundraiserResponse(
        UUID id,
        String title,
        String slug,
        String description,
        String image,
        String link,
        BigDecimal goalAmount,
        String expenses,
        boolean active,
        boolean published,
        String program,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
