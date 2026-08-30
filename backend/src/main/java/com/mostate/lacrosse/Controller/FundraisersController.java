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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Fundraiser;
import com.mostate.lacrosse.Repository.FundraiserRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/fundraisers")
public class FundraisersController {
    private final FundraiserRepository repository;
    private final AuthorizationService authorizationService;

    public FundraisersController(FundraiserRepository repository, AuthorizationService authorizationService) {
        this.repository = repository;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    public ResponseEntity<List<Fundraiser>> list() {
        return ResponseEntity.ok(repository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody Fundraiser fundraiser
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Fundraiser sanitized = new Fundraiser();
        sanitized.setTitle(TextSanitizer.clean(fundraiser.getTitle()));
        sanitized.setLink(TextSanitizer.clean(fundraiser.getLink()));
        sanitized.setActive(fundraiser.isActive());
        return ResponseEntity.ok(repository.save(sanitized));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody Fundraiser payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        Fundraiser existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        existing.setTitle(TextSanitizer.clean(payload.getTitle()));
        existing.setLink(TextSanitizer.clean(payload.getLink()));
        existing.setActive(payload.isActive());
        return ResponseEntity.ok(repository.save(existing));
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
}
