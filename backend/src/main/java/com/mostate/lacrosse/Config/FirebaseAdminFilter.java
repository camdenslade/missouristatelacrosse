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
 * Verifies Firebase ID tokens and gates access before requests reach controllers.
 *
 * Five categories, checked in this priority order:
 *   1. ADMIN_PREFIXES / ADMIN_EXACT — always require a token with the "admin" custom
 *      claim (or, for /api/admin/*, the controller does its own DB-backed admin check).
 *   2. ADMIN_WRITE_PREFIXES — same as above, but only for write methods.
 *   3. AUTH_REQUIRED_PREFIXES — require any valid token (no admin claim), all methods;
 *      the controller does its own fine-grained authorization. No legitimate anonymous
 *      use of these paths at all.
 *   4. AUTH_REQUIRED_WRITE_PREFIXES — same as #3, but only for write methods; reads
 *      stay fully open (e.g. public roster/article/game reads).
 *   5. OPTIONAL_AUTH_PREFIXES — a token is verified IF PRESENT and identity attached,
 *      but a missing/invalid token is never rejected here, since these paths mix public
 *      and controller-gated traffic on different methods/sub-paths (e.g. list events is
 *      public, admin event CRUD on the same base path is not). The controller enforces
 *      its own checks using the attached identity.
 *
 * Anything matching none of the above passes through untouched (fully public, no
 * identity attached).
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

    /**
     * Path prefixes that require a valid Firebase token on EVERY method (any
     * authenticated user), but NOT the admin custom claim — the controller does its
     * own fine-grained authorization (admin OR resource owner OR linked parent),
     * same deferred-check convention already used for /api/admin/* paths below.
     * Use this when there is no legitimate anonymous/public use of the path at all.
     */
    private static final Set<String> AUTH_REQUIRED_PREFIXES = Set.of(
        "/api/dues-payments",
        "/api/users",
        "/api/parents",
        "/api/groups"
    );

    /**
     * Path prefixes that require a valid Firebase token only for write methods
     * (POST/PUT/PATCH/DELETE) — reads stay open. Use this for resources with a
     * legitimate public read (e.g. the public roster) but that must not be
     * mutable by anonymous callers. No admin custom claim required; the
     * controller checks admin/ownership itself.
     */
    private static final Set<String> AUTH_REQUIRED_WRITE_PREFIXES = Set.of(
        "/api/players",
        "/api/fundraisers",
        "/api/alumni-budget",
        "/api/articles",
        "/api/site-content",
        "/api/games",
        "/api/sponsors",
        "/api/coaches",
        "/api/teams",
        "/api/gallery",
        "/api/uploads",
        "/api/seasons"
    );

    /**
     * Path prefixes where a Bearer token is verified IF PRESENT (so the controller
     * can tailor the response/authorization for an authenticated caller) but a
     * missing/invalid token is never rejected AT THE FILTER — since these paths
     * also serve genuinely public/anonymous traffic on some methods (e.g. the
     * public roster read, or submitting a new account-access request). The
     * controller is responsible for rejecting unauthorized callers on the
     * sub-paths/methods that actually need it (mirrors the AUTH_REQUIRED_PREFIXES
     * deferred-check convention, just without a filter-level hard reject).
     */
    private static final Set<String> OPTIONAL_AUTH_PREFIXES = Set.of(
        "/api/players",
        "/api/account-requests",
        "/api/raffles",
        "/api/events",
        "/api/email",
        "/api/recruitment",
        "/api/onboard"
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String method = request.getMethod();
        String path   = request.getRequestURI();
        boolean isWrite = isWriteMethod(method);

        // CORS preflight — always pass through
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean needsAdminClaim = requiresAdmin(method, path);
        boolean needsAuthOnly = requiresAuth(path)
            || (isWrite && matchesPrefix(path, AUTH_REQUIRED_WRITE_PREFIXES));

        if (!needsAdminClaim && !needsAuthOnly) {
            // Not a hard-gated path — but still attach identity if the caller happens to
            // be logged in and this path serves a mix of public and controller-gated
            // traffic, so the controller can enforce its own check without the filter
            // needing to know which sub-paths/methods require it.
            if (matchesPrefix(path, OPTIONAL_AUTH_PREFIXES)) {
                attachOptionalAuth(request);
            }
            filterChain.doFilter(request, response);
            return;
        }

        // Admin/auth-required path: token required
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

        // For /api/admin/ paths and auth-required (non-admin-only) paths, the controller does
        // its own DB-level authorization check. Only enforce the role claim here for stream
        // paths that have no downstream authorization.
        if (!path.startsWith("/api/admin/") && !needsAuthOnly) {
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

    /** Verifies a Bearer token if present, but never rejects the request either way. */
    private void attachOptionalAuth(HttpServletRequest request) {
        String token = extractBearerToken(request);
        if (token == null) {
            return;
        }
        try {
            FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(token);
            request.setAttribute("firebaseUid", decoded.getUid());
            request.setAttribute(FIREBASE_TOKEN_ATTR, decoded);
        } catch (Exception e) {
            // Invalid/expired token on an optional-auth path — treat as anonymous.
        }
    }

    private boolean isWriteMethod(String method) {
        return "POST".equalsIgnoreCase(method)
            || "PUT".equalsIgnoreCase(method)
            || "PATCH".equalsIgnoreCase(method)
            || "DELETE".equalsIgnoreCase(method);
    }

    private boolean matchesPrefix(String path, Set<String> prefixes) {
        for (String prefix : prefixes) {
            if (path.startsWith(prefix)) return true;
        }
        return false;
    }

    private boolean requiresAdmin(String method, String path) {
        // Always admin
        if (ADMIN_EXACT.contains(path)) return true;
        if (matchesPrefix(path, ADMIN_PREFIXES)) return true;

        // Admin only for mutations
        if (!isWriteMethod(method)) return false;
        return matchesPrefix(path, ADMIN_WRITE_PREFIXES);
    }

    private boolean requiresAuth(String path) {
        return matchesPrefix(path, AUTH_REQUIRED_PREFIXES);
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
