package com.mostate.lacrosse.Controller;

import java.time.Year;
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
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.RecruitmentSubmission;
import com.mostate.lacrosse.Model.SiteContent;
import com.mostate.lacrosse.Repository.RecruitmentSubmissionRepository;
import com.mostate.lacrosse.Repository.SiteContentRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Utils.EmailTemplate;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/recruitment")
public class RecruitmentController {
    private static final String ASSIGNEE_KEY = "recruitmentAssignee";

    private final RecruitmentSubmissionRepository repository;
    private final SiteContentRepository siteContentRepository;
    private final AuthorizationService authorizationService;
    private final EmailService emailService;

    public RecruitmentController(
        RecruitmentSubmissionRepository repository,
        SiteContentRepository siteContentRepository,
        AuthorizationService authorizationService,
        EmailService emailService
    ) {
        this.repository = repository;
        this.siteContentRepository = siteContentRepository;
        this.authorizationService = authorizationService;
        this.emailService = emailService;
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
        RecruitmentSubmission saved = repository.save(sanitizePayload(payload));
        notifyAssignee(saved);
        sendRecruitFollowUp(saved);
        return ResponseEntity.ok(saved);
    }

    // Best-effort: a submission is saved either way, even if these emails fail.
    private void notifyAssignee(RecruitmentSubmission submission) {
        try {
            SiteContent assignee = siteContentRepository.findById(ASSIGNEE_KEY).orElse(null);
            if (assignee == null) return;
            String email = (String) JsonUtils.readMap(assignee.getData()).get("email");
            if (email == null || email.isBlank()) return;

            String programLabel = "women".equalsIgnoreCase(TenantContext.getTenant()) ? "Women's" : "Men's";
            String body =
                EmailTemplate.paragraph("A new recruit submitted the " + programLabel + " recruitment form:")
                + EmailTemplate.paragraph(
                    "<b>" + submission.getName() + "</b><br>"
                    + "Email: " + submission.getEmail() + "<br>"
                    + "Phone: " + submission.getPhone() + "<br>"
                    + "High school grad year: " + submission.getClassYear() + "<br>"
                    + "Position: " + submission.getPosition() + "<br>"
                    + "Hometown: " + submission.getHometown() + ", " + submission.getState() + "<br>"
                    + "High school: " + submission.getHighSchool()
                )
                + EmailTemplate.button(
                    "https://missouristatelacrosse.com" + ("women".equalsIgnoreCase(TenantContext.getTenant()) ? "/women" : "")
                        + "/recruitment/submissions",
                    "View Submissions"
                );
            emailService.sendEmail(
                email,
                "New recruitment submission: " + submission.getName(),
                EmailTemplate.wrap(programLabel, body)
            );
        } catch (Exception ignored) {
            // Never let an email failure block a recruit's submission from being saved.
        }
    }

    private void sendRecruitFollowUp(RecruitmentSubmission submission) {
        try {
            if (submission.getEmail() == null || submission.getEmail().isBlank()) return;

            String programLabel = "women".equalsIgnoreCase(TenantContext.getTenant()) ? "Women's" : "Men's";
            String timeline = graduatingWithinAYear(submission.getClassYear())
                ? "Since you're graduating soon, we'll be in touch quickly."
                : "Since your graduation is still a ways out, it may take us a little while to "
                    + "follow up, but we have your information and will reach out.";

            String body =
                EmailTemplate.paragraph("Hi " + submission.getName() + ",")
                + EmailTemplate.paragraph(
                    "Thank you for your interest in Missouri State " + programLabel + " Lacrosse. "
                    + "We're a club program, open to any Missouri State student, and we really "
                    + "appreciate you taking the time to reach out."
                )
                + EmailTemplate.paragraph(timeline)
                + EmailTemplate.paragraph("Go Bears, and thanks again for your interest.");

            emailService.sendEmail(
                submission.getEmail(),
                "Thanks for your interest in Missouri State " + programLabel + " Lacrosse",
                EmailTemplate.wrap(programLabel, body)
            );
        } catch (Exception ignored) {
            // Never let an email failure block a recruit's submission from being saved.
        }
    }

    /** classYear is the recruit's entered high school graduation year, e.g. "2026". */
    private boolean graduatingWithinAYear(String classYear) {
        if (classYear == null) return false;
        try {
            int gradYear = Integer.parseInt(classYear.trim());
            return gradYear <= Year.now().getValue() + 1;
        } catch (NumberFormatException e) {
            return false;
        }
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
