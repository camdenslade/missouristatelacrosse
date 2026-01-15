package com.mostate.lacrosse.Config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class ProgramFilter extends OncePerRequestFilter {
    private final String headerName;
    private final String defaultProgram;
    private final Set<String> allowed = Set.of("men", "women");

    public ProgramFilter(
        @Value("${app.program.header:X-Program}") String headerName,
        @Value("${app.program.default:men}") String defaultProgram
    ) {
        this.headerName = headerName;
        this.defaultProgram = defaultProgram;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean isApiRequest = path != null && path.startsWith("/api");
        boolean isPreflight = "OPTIONS".equalsIgnoreCase(request.getMethod());
        String headerProgram = normalizeProgram(request.getHeader(headerName));
        String queryProgram = normalizeProgram(request.getParameter("program"));
        String pathProgram = normalizeProgram(resolveProgramFromPath(path));

        if (headerProgram != null && queryProgram != null && !headerProgram.equals(queryProgram)) {
            respondBadRequest(response, "Program header does not match program query parameter.");
            return;
        }
        String explicitProgram = headerProgram != null ? headerProgram
            : queryProgram != null ? queryProgram
            : pathProgram;

        if (isApiRequest && !isPreflight && explicitProgram == null) {
            respondBadRequest(response, "Program is required for API requests.");
            return;
        }

        String program = explicitProgram != null ? explicitProgram : defaultProgram;
        TenantContext.setTenant(program);
        applyProgramHeaders(request, response, program);
        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private String resolveProgramFromPath(String path) {
        if (path == null) {
            return null;
        }
        String normalized = path.toLowerCase();
        if (normalized.contains("/women")) {
            return "women";
        }
        if (normalized.contains("/men")) {
            return "men";
        }
        return null;
    }

    private String normalizeProgram(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase();
        return allowed.contains(normalized) ? normalized : null;
    }

    private void respondBadRequest(HttpServletResponse response, String message)
        throws IOException {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        response.setContentType("application/json");
        response.getWriter()
            .write("{\"error\":\"" + message.replace("\"", "") + "\"}");
    }

    private void applyProgramHeaders(
        HttpServletRequest request,
        HttpServletResponse response,
        String program
    ) {
        response.setHeader("X-Program-Resolved", program);
        addVaryHeader(response, "X-Program");
        addVaryHeader(response, "Origin");

        String path = request.getRequestURI();
        if (path != null && (path.startsWith("/api/players") || path.startsWith("/api/coaches"))) {
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Pragma", "no-cache");
        }
    }

    private void addVaryHeader(HttpServletResponse response, String value) {
        String existing = response.getHeader("Vary");
        if (existing == null || existing.isBlank()) {
            response.setHeader("Vary", value);
            return;
        }
        if (!existing.contains(value)) {
            response.setHeader("Vary", existing + ", " + value);
        }
    }
}
