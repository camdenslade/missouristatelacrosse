package com.mostate.lacrosse.Controller;

import java.time.LocalDate;
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
import com.mostate.lacrosse.Model.ComplianceFiling;
import com.mostate.lacrosse.Repository.ComplianceFilingRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

/**
 * VP's mini-page: Missouri nonprofit annual filings, yearly IRS filings, and grant
 * renewals. Internal tracking only, not part of the public site.
 */
@RestController
@RequestMapping("/api/compliance-filings")
public class ComplianceController {
    private final ComplianceFilingRepository repository;
    private final AuthorizationService authorizationService;

    public ComplianceController(ComplianceFilingRepository repository, AuthorizationService authorizationService) {
        this.repository = repository;
        this.authorizationService = authorizationService;
    }

    private boolean isVp(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isVpOrAbove(uid, program, token);
    }

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request, @RequestParam(defaultValue = "men") String program) {
        if (!isVp(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("VP access required"));
        }
        return ResponseEntity.ok(repository.findAllByOrderByDueDateAsc());
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody FilingRequest body
    ) {
        if (!isVp(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("VP access required"));
        }
        if (body.type() == null || body.type().isBlank() || body.name() == null || body.name().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Type and name are required"));
        }
        ComplianceFiling filing = new ComplianceFiling();
        applyPayload(filing, body);
        return ResponseEntity.ok(repository.save(filing));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody FilingRequest body
    ) {
        if (!isVp(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("VP access required"));
        }
        ComplianceFiling filing = repository.findById(id).orElse(null);
        if (filing == null) {
            return ResponseEntity.notFound().build();
        }
        applyPayload(filing, body);
        return ResponseEntity.ok(repository.save(filing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isVp(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("VP access required"));
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void applyPayload(ComplianceFiling filing, FilingRequest body) {
        if (body.type() != null) filing.setType(TextSanitizer.clean(body.type()));
        if (body.name() != null) filing.setName(TextSanitizer.clean(body.name()));
        if (body.lastFiled() != null) filing.setLastFiled(body.lastFiled());
        if (body.notes() != null) filing.setNotes(TextSanitizer.clean(body.notes()));
        if (body.link() != null) filing.setLink(TextSanitizer.clean(body.link()));
        if (body.recurring() != null) filing.setRecurring(body.recurring());

        // Marking a recurring filing "filed" rolls its due date forward a year instead of
        // just sitting there - e.g. a Missouri annual report due every August 31 goes
        // straight to next August 31 rather than needing the date re-entered by hand.
        if (body.status() != null) {
            String newStatus = TextSanitizer.clean(body.status());
            if ("filed".equals(newStatus) && filing.isRecurring() && filing.getDueDate() != null) {
                filing.setDueDate(filing.getDueDate().plusYears(1));
                filing.setStatus("pending");
            } else {
                filing.setStatus(newStatus);
            }
        }
        if (body.dueDate() != null) filing.setDueDate(body.dueDate());
    }

    public record FilingRequest(
        String type,
        String name,
        LocalDate dueDate,
        LocalDate lastFiled,
        String status,
        String notes,
        String link,
        Boolean recurring
    ) {}
}
