package com.mostate.lacrosse.Config;

import java.io.IOException;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Per-client-IP request throttle. In-memory token buckets, no external store - the
 * backend runs as a single instance so that is sufficient. Sits right after the CORS
 * filter and before tenant resolution, so a flood is rejected before any DB work.
 *
 * Limits are per minute, per IP, per traffic class:
 *   email    - the unauthenticated SES-backed endpoints (worst cost/abuse vector)
 *   payment  - PayPal / Stripe session creation
 *   auth     - account-request submissions
 *   write    - any other POST/PUT/PATCH/DELETE under /api
 *   read     - everything else under /api
 *
 * Tune via app.ratelimit.* in application.properties; app.ratelimit.enabled=false
 * disables it (done in the local and test profiles).
 *
 * Client IP is taken from X-Real-IP, then the first X-Forwarded-For hop, then the
 * socket address. nginx on the box must set at least one of those on proxied
 * requests or every caller shares one bucket - see docs/rate-limiting.md.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitFilter extends OncePerRequestFilter {

    private enum Tier { EMAIL, PAYMENT, AUTH, WRITE, READ }

    private static final long IDLE_EVICT_NANOS = 10L * 60 * 1_000_000_000L;

    private final boolean enabled;
    private final Map<Tier, Integer> perMinute = new EnumMap<>(Tier.class);
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
        @Value("${app.ratelimit.enabled:true}") boolean enabled,
        @Value("${app.ratelimit.email-per-minute:5}") int email,
        @Value("${app.ratelimit.payment-per-minute:30}") int payment,
        @Value("${app.ratelimit.auth-per-minute:10}") int auth,
        @Value("${app.ratelimit.write-per-minute:60}") int write,
        @Value("${app.ratelimit.read-per-minute:600}") int read
    ) {
        this.enabled = enabled;
        perMinute.put(Tier.EMAIL, email);
        perMinute.put(Tier.PAYMENT, payment);
        perMinute.put(Tier.AUTH, auth);
        perMinute.put(Tier.WRITE, write);
        perMinute.put(Tier.READ, read);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled) {
            return true;
        }
        String path = request.getRequestURI();
        if (path == null || !path.startsWith("/api/")) {
            return true;
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // Stripe's servers - legitimately bursty, and signature-verified downstream.
        return path.equals("/api/stripe/webhook");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Tier tier = classify(request);
        int limit = perMinute.get(tier);
        String key = clientIp(request) + "|" + tier;

        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(limit));
        if (!bucket.tryConsume(limit)) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.setHeader("Retry-After", "60");
            response.getWriter().write("{\"error\":\"Too many requests. Please slow down.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private Tier classify(HttpServletRequest req) {
        String path = req.getRequestURI();
        if (path.startsWith("/api/email/")) {
            return Tier.EMAIL;
        }
        if (path.startsWith("/api/paypal/") || path.startsWith("/api/stripe/")) {
            return Tier.PAYMENT;
        }
        if (path.startsWith("/api/account-requests")) {
            return Tier.AUTH;
        }
        String m = req.getMethod();
        if ("POST".equals(m) || "PUT".equals(m) || "PATCH".equals(m) || "DELETE".equals(m)) {
            return Tier.WRITE;
        }
        return Tier.READ;
    }

    private static String clientIp(HttpServletRequest req) {
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        return req.getRemoteAddr();
    }

    @Scheduled(fixedRate = 300_000L)
    void evictIdle() {
        long now = System.nanoTime();
        for (Map.Entry<String, Bucket> e : buckets.entrySet()) {
            if (now - e.getValue().lastAccessNanos() > IDLE_EVICT_NANOS) {
                buckets.remove(e.getKey(), e.getValue());
            }
        }
    }

    /** Lazily-refilled token bucket: {@code capacity} tokens, refilled to full over 60s. */
    private static final class Bucket {
        private double tokens;
        private long lastRefillNanos;
        private volatile long lastAccessNanos;

        Bucket(int capacity) {
            this.tokens = capacity;
            this.lastRefillNanos = System.nanoTime();
            this.lastAccessNanos = this.lastRefillNanos;
        }

        synchronized boolean tryConsume(int capacity) {
            long now = System.nanoTime();
            lastAccessNanos = now;
            double refill = (now - lastRefillNanos) / 1_000_000_000.0 * (capacity / 60.0);
            if (refill > 0) {
                tokens = Math.min(capacity, tokens + refill);
                lastRefillNanos = now;
            }
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }

        long lastAccessNanos() {
            return lastAccessNanos;
        }
    }
}
