package com.mostate.lacrosse.Service;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
public class S3Service {
    private final S3Presigner presigner;
    private final S3Client s3Client;
    private final String bucket;
    private final String publicBaseUrl;
    private final String menPrefix;
    private final String womenPrefix;
    private final Region region;

    public S3Service(
        @Value("${app.s3.bucket:}") String bucket,
        @Value("${app.s3.public-base-url:}") String publicBaseUrl,
        @Value("${app.s3.prefix.men:men}") String menPrefix,
        @Value("${app.s3.prefix.women:women}") String womenPrefix,
        @Value("${aws.region:us-east-1}") String region
    ) {
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl;
        this.menPrefix = menPrefix;
        this.womenPrefix = womenPrefix;
        this.region = Region.of(region);
        this.presigner = S3Presigner.builder()
            .region(this.region)
            .build();
        this.s3Client = S3Client.builder()
            .region(this.region)
            .build();
    }

    public PresignResult presignUpload(String program, String folder, String filename, String contentType) {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("S3 bucket is not configured");
        }

        String safeFolder = normalizeFolder(sanitize(folder));
        String safeFile = sanitize(filename);
        boolean shared = safeFolder.equals("logos") || safeFolder.startsWith("logos/");
        String prefix = "women".equalsIgnoreCase(program) ? womenPrefix : menPrefix;
        String basePath = shared ? safeFolder : String.format("%s/%s", prefix, safeFolder);
        String key = String.format("%s/%s_%s", basePath, UUID.randomUUID(), safeFile);

        PutObjectRequest objectRequest = PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(contentType)
            .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(10))
            .putObjectRequest(objectRequest)
            .build();

        PresignedPutObjectRequest presigned = presigner.presignPutObject(presignRequest);

        return new PresignResult(
            presigned.url(),
            key,
            buildPublicUrl(key)
        );
    }

    public ResponseInputStream<GetObjectResponse> getObjectStream(String key) {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("S3 bucket is not configured");
        }
        GetObjectRequest request = GetObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .build();
        return s3Client.getObject(request);
    }

    public String presignGetUrl(String key, Duration ttl) {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("S3 bucket is not configured");
        }
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("S3 key is required");
        }
        GetObjectRequest objectRequest = GetObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .getObjectRequest(objectRequest)
            .build();
        return presigner.presignGetObject(presignRequest).url().toString();
    }

    public boolean isAllowedKey(String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        String normalized = key.replace("\\", "/");
        return normalized.startsWith("men/")
            || normalized.startsWith("women/")
            || normalized.startsWith("logos/");
    }

    public String toPresignedUrl(String value, Duration ttl) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String trimmed = value.trim();
        if (trimmed.contains("/api/uploads/object?")) {
            return trimmed;
        }
        String key = extractKey(trimmed);
        if (key == null || key.isBlank()) {
            return trimmed;
        }
        if (!isAllowedKey(key)) {
            return trimmed;
        }
        return presignGetUrl(key, ttl);
    }

    public String extractKey(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (!trimmed.contains("://")) {
            return normalizeKey(trimmed);
        }
        try {
            URI uri = URI.create(trimmed);
            String host = uri.getHost();
            String path = uri.getPath();
            if (host == null || path == null) {
                return null;
            }
            String key = null;
            if (host.startsWith(bucket + ".")) {
                key = path.substring(1);
            } else if (publicBaseUrl != null && !publicBaseUrl.isBlank()) {
                URI publicUri = URI.create(publicBaseUrl);
                if (host.equalsIgnoreCase(publicUri.getHost())) {
                    key = path.substring(1);
                }
            } else if (host.startsWith("s3.") || host.equalsIgnoreCase("s3.amazonaws.com")) {
                String[] parts = path.split("/", 3);
                if (parts.length >= 3 && parts[1].equals(bucket)) {
                    key = parts[2];
                }
            }
            if (key == null || key.isBlank()) {
                return null;
            }
            key = URLDecoder.decode(key, StandardCharsets.UTF_8);
            return normalizeKey(key);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String normalizeKey(String key) {
        if (key == null) {
            return null;
        }
        String normalized = key.trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.contains("..")) {
            return null;
        }
        return normalized;
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "uploads";
        }
        String safe = value.trim().replace("\\", "/");
        safe = safe.replaceAll("[^a-zA-Z0-9._/-]", "_");
        safe = safe.replaceAll("/+", "/");
        safe = safe.replaceAll("^/|/$", "");
        return safe.toLowerCase(Locale.ROOT);
    }

    private String normalizeFolder(String folder) {
        if ("gallery".equals(folder)) {
            return "galleries";
        }
        if (folder.startsWith("gallery/")) {
            return "galleries/" + folder.substring("gallery/".length());
        }
        return folder;
    }

    public String buildPublicUrl(String key) {
        if (publicBaseUrl != null && !publicBaseUrl.isBlank()) {
            String base = publicBaseUrl.endsWith("/") ? publicBaseUrl : publicBaseUrl + "/";
            return base + key;
        }
        return URI.create(String.format("https://%s.s3.%s.amazonaws.com/%s", bucket, region.id(), key))
            .toString();
    }

    public record PresignResult(java.net.URL uploadUrl, String key, String publicUrl) {}
}
