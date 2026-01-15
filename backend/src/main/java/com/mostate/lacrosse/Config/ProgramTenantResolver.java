package com.mostate.lacrosse.Config;

import java.util.Set;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ProgramTenantResolver implements CurrentTenantIdentifierResolver<String> {
    private final String defaultTenant;
    private final Set<String> allowedTenants = Set.of("men", "women");

    public ProgramTenantResolver(
        @Value("${app.program.default:men}") String defaultTenant
    ) {
        this.defaultTenant = defaultTenant;
    }

    @Override
    public String resolveCurrentTenantIdentifier() {
        String tenant = TenantContext.getTenant();
        if (tenant == null || tenant.isBlank()) {
            return defaultTenant;
        }
        String normalized = tenant.trim().toLowerCase();
        return allowedTenants.contains(normalized) ? normalized : defaultTenant;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}
