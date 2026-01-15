package com.mostate.lacrosse.Controller;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import com.mostate.lacrosse.Model.Article;
import com.mostate.lacrosse.Repository.ArticleRepository;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/articles")
public class ArticlesController {
    private final ArticleRepository repository;
    private final S3Service s3Service;

    public ArticlesController(ArticleRepository repository, S3Service s3Service) {
        this.repository = repository;
        this.s3Service = s3Service;
    }

    @GetMapping
    public ResponseEntity<List<ArticleResponse>> list(
        @RequestParam(defaultValue = "false") boolean published,
        @RequestParam(required = false) Integer limit
    ) {
        java.time.Duration ttl = java.time.Duration.ofMinutes(15);
        if (published) {
            List<Article> articles = repository.findAllByPublishedTrueOrderByCreatedAtDesc();
            if (limit != null && limit > 0 && articles.size() > limit) {
                return ResponseEntity.ok(articles.subList(0, limit).stream()
                    .map(article -> toResponse(article, ttl))
                    .toList());
            }
            return ResponseEntity.ok(articles.stream()
                .map(article -> toResponse(article, ttl))
                .toList());
        }

        if (limit != null && limit > 0) {
            var page = repository.findAll(
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"))
            );
            return ResponseEntity.ok(page.getContent().stream()
                .map(article -> toResponse(article, ttl))
                .toList());
        }

        return ResponseEntity.ok(
            repository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(article -> toResponse(article, ttl))
                .toList()
        );
    }

    @PostMapping
    public ResponseEntity<ArticleResponse> create(@RequestBody Article article) {
        Article sanitized = sanitizeArticle(article);
        Article saved = repository.save(sanitized);
        return ResponseEntity.ok(toResponse(saved, java.time.Duration.ofMinutes(15)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ArticleResponse> update(@PathVariable UUID id, @RequestBody Article payload) {
        Article existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        existing.setTitle(TextSanitizer.clean(payload.getTitle()));
        existing.setContent(TextSanitizer.clean(payload.getContent()));
        existing.setImageUrl(TextSanitizer.clean(payload.getImageUrl()));
        existing.setPublished(payload.isPublished());

        Article saved = repository.save(existing);
        return ResponseEntity.ok(toResponse(saved, java.time.Duration.ofMinutes(15)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private ArticleResponse toResponse(Article article, java.time.Duration ttl) {
        return new ArticleResponse(
            article.getId(),
            article.getTitle(),
            article.getContent(),
            s3Service.toPresignedUrl(article.getImageUrl(), ttl),
            article.isPublished(),
            article.getCreatedAt(),
            article.getUpdatedAt()
        );
    }

    private Article sanitizeArticle(Article article) {
        Article sanitized = new Article();
        sanitized.setTitle(TextSanitizer.clean(article.getTitle()));
        sanitized.setContent(TextSanitizer.clean(article.getContent()));
        sanitized.setImageUrl(TextSanitizer.clean(article.getImageUrl()));
        sanitized.setPublished(article.isPublished());
        return sanitized;
    }

    public record ArticleResponse(
        UUID id,
        String title,
        String content,
        String image,
        boolean published,
        java.time.Instant createdAt,
        java.time.Instant updatedAt
    ) {}
}
