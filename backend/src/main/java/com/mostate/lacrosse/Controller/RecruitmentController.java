package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Model.RecruitmentSubmission;
import com.mostate.lacrosse.Repository.RecruitmentSubmissionRepository;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/recruitment")
public class RecruitmentController {
    private final RecruitmentSubmissionRepository repository;

    public RecruitmentController(RecruitmentSubmissionRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<RecruitmentSubmission>> list() {
        return ResponseEntity.ok(repository.findAll());
    }

    @PostMapping
    public ResponseEntity<RecruitmentSubmission> create(@RequestBody RecruitmentSubmission payload) {
        return ResponseEntity.ok(repository.save(sanitizePayload(payload)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
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
