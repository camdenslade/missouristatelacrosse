package com.mostate.lacrosse.Controller;

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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Season;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.SeasonService;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/seasons")
public class SeasonController {

    private final SeasonService seasonService;
    private final AuthorizationService authorizationService;

    public SeasonController(SeasonService seasonService, AuthorizationService authorizationService) {
        this.seasonService = seasonService;
        this.authorizationService = authorizationService;
    }

    // Public: every season dropdown (Roster/Schedule/Payments/Stats) reads this.
    @GetMapping
    public ResponseEntity<List<SeasonResponse>> list() {
        return ResponseEntity.ok(seasonService.list().stream().map(this::toResponse).toList());
    }

    // Public: consumers that just need "what's the active season" without the full list.
    @GetMapping("/active")
    public ResponseEntity<ActiveSeasonResponse> active() {
        return ResponseEntity.ok(new ActiveSeasonResponse(seasonService.getActiveCode()));
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest request, @RequestBody SeasonPayload payload) {
        if (!isAdmin(request)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try {
            Season season = seasonService.create(payload.code(), payload.label(), payload.sortOrder());
            return ResponseEntity.ok(toResponse(season));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(e.getReason()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(HttpServletRequest request, @PathVariable UUID id, @RequestBody SeasonPayload payload) {
        if (!isAdmin(request)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try {
            Season season = seasonService.update(id, payload.label(), payload.sortOrder());
            return ResponseEntity.ok(toResponse(season));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(e.getReason()));
        }
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<?> activate(HttpServletRequest request, @PathVariable UUID id) {
        if (!isAdmin(request)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try {
            Season season = seasonService.setActive(id);
            return ResponseEntity.ok(toResponse(season));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(e.getReason()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(HttpServletRequest request, @PathVariable UUID id) {
        if (!isAdmin(request)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        try {
            seasonService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(e.getReason()));
        }
    }

    private boolean isAdmin(HttpServletRequest request) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, TenantContext.getTenant(), token);
    }

    private SeasonResponse toResponse(Season s) {
        return new SeasonResponse(s.getId(), s.getCode(), s.getLabel(), s.isActive(), s.getSortOrder());
    }

    public record SeasonPayload(String code, String label, Integer sortOrder) {}
    public record SeasonResponse(UUID id, String code, String label, boolean active, int sortOrder) {}
    public record ActiveSeasonResponse(String code) {}
}
