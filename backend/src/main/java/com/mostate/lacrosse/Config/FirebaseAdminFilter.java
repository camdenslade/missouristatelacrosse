package com.mostate.lacrosse.Config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Verifies Firebase ID tokens on admin-only endpoints.
 *
 * Admin paths: require a valid Bearer token whose Firebase custom claim
 * "role" equals "admin".
 *
 * All other paths pass through without modification.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class FirebaseAdminFilter extends OncePerRequestFilter {

    public static final String FIREBASE_TOKEN_ATTR = "firebaseToken";
    private static final Logger log = LoggerFactory.getLogger(FirebaseAdminFilter.class);

    /**
     * Path prefixes that are always admin-only (any HTTP method).
     */
    private static final Set<String> ADMIN_PREFIXES = Set.of(
        "/api/admin/",
        "/api/stream/admin/"
    );

    /**
     * Exact paths that are admin-only (any HTTP method).
     */
    private static final Set<String> ADMIN_EXACT = Set.of(
        "/api/stream/setup"
    );

    /**
     * Path prefixes that are admin-only for write methods (POST/PUT/PATCH/DELETE).
     */
    private static final Set<String> ADMIN_WRITE_PREFIXES = Set.of(
        "/api/stream/config/",
        "/api/stream/go-live/",
        "/api/stream/keys",
        "/api/stream/chat/"
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String method = request.getMethod();
        String path   = request.getRequestURI();

        // CORS preflight — always pass through
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!requiresAdmin(method, path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // ── Admin path: token required ────────────────────────────────────────
        String token = extractBearerToken(request);
        if (token == null) {
            rejectUnauthorized(response, "Authentication required");
            return;
        }

        FirebaseToken decoded;
        try {
            decoded = FirebaseAuth.getInstance().verifyIdToken(token);
        } catch (Exception e) {
            log.warn("Firebase token verification failed for {} {}: {}", method, path, e.getMessage());
            rejectUnauthorized(response, "Invalid or expired token");
            return;
        }

        // For /api/admin/ paths, the controller does its own DB-level admin check (isAdmin()).
        // Only enforce the role claim for stream paths that have no downstream authorization.
        if (!path.startsWith("/api/admin/")) {
            Object role = decoded.getClaims().get("role");
            if (!"admin".equals(role)) {
                log.warn("Access denied for uid={} role={} on {} {}", decoded.getUid(), role, method, path);
                rejectForbidden(response, "Admin access required");
                return;
            }
        }

        // Expose UID downstream so controllers can use it if needed
        request.setAttribute("firebaseUid", decoded.getUid());
        request.setAttribute(FIREBASE_TOKEN_ATTR, decoded);
        filterChain.doFilter(request, response);
    }

    private boolean requiresAdmin(String method, String path) {
        // Always admin
        if (ADMIN_EXACT.contains(path)) return true;
        for (String prefix : ADMIN_PREFIXES) {
            if (path.startsWith(prefix)) return true;
        }

        // Admin only for mutations
        boolean isWrite = "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
        if (!isWrite) return false;

        for (String prefix : ADMIN_WRITE_PREFIXES) {
            if (path.startsWith(prefix)) return true;
        }
        return false;
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
    }

    private void rejectUnauthorized(HttpServletResponse response, String message) throws IOException {
        writeJson(response, HttpServletResponse.SC_UNAUTHORIZED, message);
    }

    private void rejectForbidden(HttpServletResponse response, String message) throws IOException {
        writeJson(response, HttpServletResponse.SC_FORBIDDEN, message);
    }

    private void writeJson(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        String body = new ObjectMapper().writeValueAsString(Map.of("error", message));
        response.getWriter().write(body);
    }
}
