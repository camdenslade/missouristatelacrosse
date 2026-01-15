package com.mostate.lacrosse.Controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.mostate.lacrosse.Model.SiteContent;
import com.mostate.lacrosse.Repository.SiteContentRepository;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/site-content")
@Validated
public class SiteContentController {
    private final SiteContentRepository repository;

    public SiteContentController(SiteContentRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/{key}")
    public ResponseEntity<SiteContentResponse> get(@PathVariable String key) {
        String sanitizedKey = TextSanitizer.clean(key);
        SiteContent existing = repository.findById(sanitizedKey).orElse(null);
        if (existing == null) {
            if (isInstagramKey(sanitizedKey)) {
                Map<String, Object> data = new HashMap<>();
                data.put("posts", List.of());
                SiteContent created = new SiteContent();
                created.setContentKey(sanitizedKey);
                created.setData(JsonUtils.toJson(data));
                SiteContent saved = repository.save(created);
                return ResponseEntity.ok(new SiteContentResponse(
                    saved.getContentKey(),
                    data
                ));
            }
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(new SiteContentResponse(
            existing.getContentKey(),
            JsonUtils.readMap(existing.getData())
        ));
    }

    @PutMapping("/{key}")
    public ResponseEntity<SiteContentResponse> upsert(
        @PathVariable String key,
        @Valid @RequestBody SiteContentPayload payload
    ) {
        String sanitizedKey = TextSanitizer.clean(key);
        SiteContent existing = repository.findById(sanitizedKey).orElseGet(SiteContent::new);
        existing.setContentKey(sanitizedKey);
        existing.setData(JsonUtils.toJson(TextSanitizer.cleanMap(payload.data())));
        SiteContent saved = repository.save(existing);
        return ResponseEntity.ok(new SiteContentResponse(
            saved.getContentKey(),
            JsonUtils.readMap(saved.getData())
        ));
    }

    public static class SiteContentPayload {
        private final Map<String, Object> data = new HashMap<>();

        @JsonAnySetter
        public void set(String key, Object value) {
            data.put(key, value);
        }

        public Map<String, Object> data() {
            return data;
        }
    }

    public record SiteContentResponse(String key, Map<String, Object> data) {}

    private boolean isInstagramKey(String key) {
        return "instagramFeed".equals(key) || "instagramFeedw".equals(key);
    }
}
