package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Team;
import com.mostate.lacrosse.Repository.TeamRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/teams")
public class TeamsController {
    private final TeamRepository teamRepository;
    private final S3Service s3Service;
    private final AuthorizationService authorizationService;

    public TeamsController(TeamRepository teamRepository, S3Service s3Service, AuthorizationService authorizationService) {
        this.teamRepository = teamRepository;
        this.s3Service = s3Service;
        this.authorizationService = authorizationService;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    @GetMapping
    public ResponseEntity<List<TeamResponse>> list() {
        java.time.Duration ttl = S3Service.IMAGE_TTL;
        return ResponseEntity.ok(teamRepository.findAll().stream()
            .map(team -> toResponse(team, ttl))
            .toList());
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody Team team
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        sanitizeTeam(team);
        Team saved = teamRepository.save(team);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody Team payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Team existing = teamRepository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        existing.setName(TextSanitizer.clean(payload.getName()));
        existing.setLogoUrl(TextSanitizer.clean(payload.getLogoUrl()));
        existing.setLink(TextSanitizer.clean(payload.getLink()));
        Team saved = teamRepository.save(existing);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    private void sanitizeTeam(Team team) {
        team.setName(TextSanitizer.clean(team.getName()));
        team.setLogoUrl(TextSanitizer.clean(team.getLogoUrl()));
        team.setLink(TextSanitizer.clean(team.getLink()));
    }

    private TeamResponse toResponse(Team team, java.time.Duration ttl) {
        String signedLogo = s3Service.toPresignedUrl(team.getLogoUrl(), ttl);
        return new TeamResponse(
            team.getId(),
            team.getName(),
            team.getNameLower(),
            signedLogo,
            signedLogo,
            team.getLink(),
            team.getCreatedAt(),
            team.getUpdatedAt()
        );
    }

    public record TeamResponse(
        UUID id,
        String name,
        String nameLower,
        String logoUrl,
        String logo,
        String link,
        java.time.Instant createdAt,
        java.time.Instant updatedAt
    ) {}
}
