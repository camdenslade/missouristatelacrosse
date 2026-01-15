package com.mostate.lacrosse.Config;

import java.util.Map;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HibernateTenantConfig implements HibernatePropertiesCustomizer {
    private final MultiTenantConnectionProvider<String> connectionProvider;
    private final CurrentTenantIdentifierResolver<String> tenantResolver;

    public HibernateTenantConfig(
        MultiTenantConnectionProvider<String> connectionProvider,
        CurrentTenantIdentifierResolver<String> tenantResolver
    ) {
        this.connectionProvider = connectionProvider;
        this.tenantResolver = tenantResolver;
    }

    @Override
    public void customize(Map<String, Object> hibernateProperties) {
        Object multiTenancy = hibernateProperties.get("hibernate.multiTenancy");
        if (multiTenancy != null && "NONE".equalsIgnoreCase(multiTenancy.toString())) {
            return;
        }
        hibernateProperties.put("hibernate.multiTenancy", "SCHEMA");
        hibernateProperties.put(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, connectionProvider);
        hibernateProperties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, tenantResolver);
    }
}
