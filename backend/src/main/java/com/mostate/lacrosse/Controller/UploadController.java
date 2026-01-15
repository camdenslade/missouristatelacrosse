package com.mostate.lacrosse.Controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.UploadPresignResponse;
import com.mostate.lacrosse.Service.S3Service;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@RestController
@RequestMapping("/api/uploads")
@Validated
public class UploadController {
    private final S3Service s3Service;

    public UploadController(S3Service s3Service) {
        this.s3Service = s3Service;
    }

    @PostMapping("/presign")
    public ResponseEntity<UploadPresignResponse> presign(@Valid @RequestBody PresignRequest request) {
        String program = TenantContext.getTenant();
        var result = s3Service.presignUpload(
            program,
            request.folder(),
            request.filename(),
            request.contentType()
        );
        return ResponseEntity.ok(new UploadPresignResponse(
            result.uploadUrl().toString(),
            result.key(),
            result.key()
        ));
    }

    @GetMapping("/object")
    public ResponseEntity<StreamingResponseBody> getObject(
        @RequestParam(required = false) String key,
        @RequestParam(required = false) String url
    ) {
        String resolvedKey = key;
        if ((resolvedKey == null || resolvedKey.isBlank()) && url != null) {
            resolvedKey = s3Service.extractKey(url);
        }
        if (resolvedKey == null || resolvedKey.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (!s3Service.isAllowedKey(resolvedKey)) {
            return ResponseEntity.status(403).build();
        }

        try {
            var stream = s3Service.getObjectStream(resolvedKey);
            String contentType = stream.response().contentType();
            long contentLength = stream.response().contentLength();
            StreamingResponseBody body = outputStream -> {
                try (var s3Stream = stream) {
                    s3Stream.transferTo(outputStream);
                }
            };
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300");
            if (contentType != null && !contentType.isBlank()) {
                builder.contentType(MediaType.parseMediaType(contentType));
            }
            if (contentLength > 0) {
                builder.contentLength(contentLength);
            }
            return builder.body(body);
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            return ResponseEntity.notFound().build();
        } catch (software.amazon.awssdk.services.s3.model.S3Exception e) {
            int status = e.statusCode();
            if (status == 404) {
                return ResponseEntity.notFound().build();
            }
            if (status == 403) {
                return ResponseEntity.status(403).build();
            }
            return ResponseEntity.status(502).build();
        }
    }

    public record PresignRequest(
        @NotBlank String folder,
        @NotBlank String filename,
        @NotBlank String contentType
    ) {}
}
