package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.GalleryFolder;
import com.mostate.lacrosse.Repository.GalleryFolderRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

@RestController
@RequestMapping("/api/gallery")
@Validated
public class GalleryController {
    private final GalleryFolderRepository repository;
    private final S3Service s3Service;
    private final AuthorizationService authorizationService;

    public GalleryController(GalleryFolderRepository repository, S3Service s3Service, AuthorizationService authorizationService) {
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
    public ResponseEntity<Map<String, GalleryFolderResponse>> listAll() {
        java.time.Duration ttl = S3Service.IMAGE_TTL;
        Map<String, GalleryFolderResponse> data = repository.findAll().stream().collect(Collectors.toMap(
            GalleryFolder::getId,
            folder -> toResponse(folder, ttl)
        ));
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{folder}")
    public ResponseEntity<GalleryFolderResponse> getFolder(@PathVariable String folder) {
        String sanitizedFolder = TextSanitizer.clean(folder);
        GalleryFolder existing = repository.findById(sanitizedFolder).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(existing, S3Service.IMAGE_TTL));
    }

    @PutMapping("/{folder}")
    public ResponseEntity<?> upsert(
        HttpServletRequest request,
        @PathVariable String folder,
        @RequestParam(defaultValue = "men") String program,
        @Valid @RequestBody GalleryPayload payload
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        String sanitizedFolder = TextSanitizer.clean(folder);
        GalleryFolder existing = repository.findById(sanitizedFolder).orElseGet(GalleryFolder::new);
        existing.setId(sanitizedFolder);
        if (payload.urls() != null) {
            existing.setUrls(JsonUtils.toJson(TextSanitizer.cleanStringList(payload.urls())));
        }
        GalleryFolder saved = repository.save(existing);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    @DeleteMapping("/{folder}/photo")
    public ResponseEntity<?> deletePhoto(
        HttpServletRequest request,
        @PathVariable String folder,
        @RequestParam String key,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        String sanitizedFolder = TextSanitizer.clean(folder);
        String sanitizedKey = s3Service.extractKey(key);
        if (sanitizedKey == null || !s3Service.isAllowedKey(sanitizedKey)) {
            return ResponseEntity.badRequest().build();
        }
        GalleryFolder existing = repository.findById(sanitizedFolder).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();

        try {
            s3Service.deleteObject(sanitizedKey);
        } catch (Exception e) {
            System.err.println("S3 delete failed for key: " + sanitizedKey + " — " + e.getMessage());
        }

        List<String> filtered = JsonUtils.readList(existing.getUrls()).stream()
            .map(String::valueOf)
            .filter(u -> {
                String storedKey = s3Service.extractKey(u);
                return !sanitizedKey.equals(storedKey);
            })
            .collect(Collectors.toList());
        existing.setUrls(JsonUtils.toJson(filtered));
        GalleryFolder saved = repository.save(existing);
        return ResponseEntity.ok(toResponse(saved, S3Service.IMAGE_TTL));
    }

    @DeleteMapping("/{folder}")
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable String folder,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        String sanitized = TextSanitizer.clean(folder);
        repository.findById(sanitized).ifPresent(existing -> {
            JsonUtils.readList(existing.getUrls()).stream()
                .map(String::valueOf)
                .forEach(raw -> {
                    String key = s3Service.extractKey(raw);
                    if (key != null && s3Service.isAllowedKey(key)) {
                        try {
                            s3Service.deleteObject(key);
                        } catch (Exception e) {
                            // Log but don't block deletion if one S3 object fails
                            System.err.println("Failed to delete S3 object: " + key + " — " + e.getMessage());
                        }
                    }
                });
            repository.deleteById(sanitized);
        });
        return ResponseEntity.noContent().build();
    }

    private GalleryFolderResponse toResponse(GalleryFolder folder, java.time.Duration ttl) {
        List<String> urls = JsonUtils.readList(folder.getUrls()).stream()
            .map(String::valueOf)
            .map(url -> s3Service.toPresignedUrl(url, ttl))
            .collect(Collectors.toList());
        return new GalleryFolderResponse(
            folder.getId(),
            urls,
            folder.getUpdatedAt()
        );
    }

    public record GalleryPayload(@NotNull List<String> urls) {}

    public record GalleryFolderResponse(String folder, List<String> urls, java.time.Instant updatedAt) {}
}
