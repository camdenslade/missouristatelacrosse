package com.mostate.lacrosse.Controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.RecruitmentSubmission;
import com.mostate.lacrosse.Repository.RecruitmentSubmissionRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/recruitment")
public class RecruitmentController {
    private final RecruitmentSubmissionRepository repository;
    private final AuthorizationService authorizationService;

    public RecruitmentController(RecruitmentSubmissionRepository repository, AuthorizationService authorizationService) {
        this.repository = repository;
        this.authorizationService = authorizationService;
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    // Admin: submissions carry prospect PII (email, phone, hometown, etc).
    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request, @RequestParam(defaultValue = "men") String program) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        return ResponseEntity.ok(repository.findAll());
    }

    // Public: the recruitment form itself.
    @PostMapping
    public ResponseEntity<RecruitmentSubmission> create(@RequestBody RecruitmentSubmission payload) {
        return ResponseEntity.ok(repository.save(sanitizePayload(payload)));
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

    private RecruitmentSubmission sanitizePayload(RecruitmentSubmission payload) {
        RecruitmentSubmission sanitized = new RecruitmentSubmission();
        sanitized.setName(TextSanitizer.clean(payload.getName()));
        sanitized.setEmail(TextSanitizer.clean(payload.getEmail()));
        sanitized.setPhone(TextSanitizer.clean(payload.getPhone()));
        sanitized.setClassYear(TextSanitizer.clean(payload.getClassYear()));
        sanitized.setPosition(TextSanitizer.clean(payload.getPosition()));
        sanitized.setHometown(TextSanitizer.clean(payload.getHometown()));
        sanitized.setHighSchool(TextSanitizer.clean(payload.getHighSchool()));
        sanitized.setState(TextSanitizer.clean(payload.getState()));
        sanitized.setInstagram(TextSanitizer.clean(payload.getInstagram()));
        return sanitized;
    }
}
