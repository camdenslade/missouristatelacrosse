package com.mostate.lacrosse.Controller.Admin;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.CustomProduct;
import com.mostate.lacrosse.Model.CustomProductVariant;
import com.mostate.lacrosse.Repository.CustomProductRepository;
import com.mostate.lacrosse.Repository.CustomProductVariantRepository;
import com.mostate.lacrosse.Service.PrintifyOrderLogService;
import com.mostate.lacrosse.Service.S3Service;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/admin/custom-products")
public class CustomProductController {

    private final CustomProductRepository repository;
    private final CustomProductVariantRepository variantRepository;
    private final PrintifyOrderLogService orderLogService;
    private final S3Service s3Service;

    public CustomProductController(CustomProductRepository repository,
                                   CustomProductVariantRepository variantRepository,
                                   PrintifyOrderLogService orderLogService,
                                   S3Service s3Service) {
        this.repository = repository;
        this.variantRepository = variantRepository;
        this.orderLogService = orderLogService;
        this.s3Service = s3Service;
    }

    private void validateAdmin(HttpServletRequest request, String userId, String userIdParam, String program) {
        String effectiveUserId = userId != null ? userId: userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);

        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN, "Admin access required"
            );
        }
    }

    // ── Products ──────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> getAll(HttpServletRequest request,
                                    @RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestParam(value = "userId", required = false) String userIdParam,
                                    @RequestParam(value = "program", defaultValue = "men") String program) {
        validateAdmin(request, userId, userIdParam, program);
        List<CustomProduct> products = repository.findAll();

        List<UpdateProductRequest> response = products.stream().map(p -> {
            UpdateProductRequest dto = new UpdateProductRequest();
            dto.setId(p.getId());
            dto.setTitle(p.getTitle());
            dto.setPrice(p.getPrice());
            dto.setDescription(p.getDescription());
            dto.setActive(p.isActive());
            dto.setPictureUrl(s3Service.toPresignedUrl(p.getPictureUrl(), S3Service.IMAGE_TTL));

            return dto;
        }).toList();
        return ResponseEntity.ok(response);
    }

     @PostMapping
     public ResponseEntity<?> addProduct(
         HttpServletRequest request,
         @RequestHeader(value = "X-User-Id", required = false) String userId,
         @RequestParam(value = "userId", required = false) String userIdParam,
         @RequestParam(value = "program", defaultValue = "men") String program,
         @RequestBody UpdateProductRequest body) { // Use the DTO here!

         // Admin check...
         validateAdmin(request, userId, userIdParam, program);

         CustomProduct product = new CustomProduct();
         product.setTitle(body.getTitle());
         product.setPrice(body.getPrice());
         product.setDescription(body.getDescription());
         product.setPictureUrl(body.getPictureUrl()); // Match the JSON key
        
         repository.save(product);
         return ResponseEntity.ok(product);
     }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Long id,
                                           @RequestBody UpdateProductRequest body,
                                           HttpServletRequest request,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @RequestParam(value = "userId", required = false) String userIdParam,
                                           @RequestParam(value = "program", defaultValue = "men") String program) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        CustomProduct product = repository.findById(id).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }
        if (body.getTitle() != null) product.setTitle(body.getTitle());
        if (body.getPrice() != null) product.setPrice(body.getPrice());
        if (body.getDescription() != null) product.setDescription(body.getDescription());
        if (body.getPictureUrl() != null) product.setPictureUrl(body.getPictureUrl());
        if (body.getActive() != null) product.setActive(body.getActive());
        repository.save(product);
        return ResponseEntity.ok(product);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable Long id,
                                           HttpServletRequest request,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @RequestParam(value = "userId", required = false) String userIdParam,
                                           @RequestParam(value = "program", defaultValue = "men") String program) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ── Variants ──────────────────────────────────────────────────────────────

    @GetMapping("/{productId}/variants")
    public ResponseEntity<?> getVariants(@PathVariable Long productId,
                                         HttpServletRequest request,
                                         @RequestHeader(value = "X-User-Id", required = false) String userId,
                                         @RequestParam(value = "userId", required = false) String userIdParam,
                                         @RequestParam(value = "program", defaultValue = "men") String program) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        return ResponseEntity.ok(variantRepository.findByProductId(productId));
    }

    @PostMapping("/{productId}/variants")
    public ResponseEntity<?> addVariant(@PathVariable Long productId,
                                        @RequestBody VariantRequest body,
                                        HttpServletRequest request,
                                        @RequestHeader(value = "X-User-Id", required = false) String userId,
                                        @RequestParam(value = "userId", required = false) String userIdParam,
                                        @RequestParam(value = "program", defaultValue = "men") String program) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        CustomProduct product = repository.findById(productId).orElse(null);
        if (product == null) return ResponseEntity.notFound().build();

        CustomProductVariant variant = new CustomProductVariant();
        variant.setProduct(product);
        variant.setLabel(body.getLabel());
        variant.setPrice(body.getPrice());
        variant.setStock(body.getStock() != null ? body.getStock() : 0);
        variantRepository.save(variant);
        return ResponseEntity.ok(variant);
    }

    @PutMapping("/{productId}/variants/{variantId}")
    public ResponseEntity<?> updateVariant(@PathVariable Long productId,
                                           @PathVariable Long variantId,
                                           @RequestBody VariantRequest body,
                                           HttpServletRequest request,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @RequestParam(value = "userId", required = false) String userIdParam,
                                           @RequestParam(value = "program", defaultValue = "men") String program) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        CustomProductVariant variant = variantRepository.findById(variantId).orElse(null);
        if (variant == null || !variant.getProduct().getId().equals(productId)) {
            return ResponseEntity.notFound().build();
        }
        if (body.getLabel() != null) variant.setLabel(body.getLabel());
        if (body.getPrice() != null) variant.setPrice(body.getPrice());
        if (body.getStock() != null) variant.setStock(body.getStock());
        variantRepository.save(variant);
        return ResponseEntity.ok(variant);
    }

    @DeleteMapping("/{productId}/variants/{variantId}")
    public ResponseEntity<?> deleteVariant(@PathVariable Long productId,
                                           @PathVariable Long variantId,
                                           HttpServletRequest request,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @RequestParam(value = "userId", required = false) String userIdParam,
                                           @RequestParam(value = "program", defaultValue = "men") String program) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        if (!orderLogService.isAdmin(effectiveUserId, program, token)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        CustomProductVariant variant = variantRepository.findById(variantId).orElse(null);
        if (variant == null || !variant.getProduct().getId().equals(productId)) {
            return ResponseEntity.notFound().build();
        }
        variantRepository.delete(variant);
        return ResponseEntity.ok().build();
    }

    // ── Request DTOs ──────────────────────────────────────────────────────────

    public static class UpdateProductRequest {
        private Long id;
        private String title;
        private BigDecimal price;
        private String description;
        private String pictureUrl;
        private Boolean active;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getPictureUrl() { return pictureUrl; }
        public void setPictureUrl(String pictureUrl) { this.pictureUrl = pictureUrl; }
        public Boolean getActive() { return active; }
        public void setActive(Boolean active) { this.active = active; }
    }

    public static class VariantRequest {
        private String label;
        private BigDecimal price;
        private Integer stock;

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
        public Integer getStock() { return stock; }
        public void setStock(Integer stock) { this.stock = stock; }
    }
}