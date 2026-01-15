package com.mostate.lacrosse.Config;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Set;
import javax.sql.DataSource;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.hibernate.service.UnknownUnwrapTypeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SchemaMultiTenantConnectionProvider implements MultiTenantConnectionProvider<String> {
    private static final long serialVersionUID = 1L;
    private final DataSource dataSource;
    private final String defaultTenant;
    private final Set<String> allowedTenants = Set.of("men", "women");

    public SchemaMultiTenantConnectionProvider(
        DataSource dataSource,
        @Value("${app.program.default:men}") String defaultTenant
    ) {
        this.dataSource = dataSource;
        this.defaultTenant = defaultTenant;
    }

    @Override
    public Connection getAnyConnection() throws SQLException {
        Connection connection = dataSource.getConnection();
        connection.setSchema(defaultTenant);
        return connection;
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        connection.setSchema(defaultTenant);
        connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        Connection connection = getAnyConnection();
        String tenant = resolveTenant(tenantIdentifier);
        connection.setSchema(tenant);
        return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection) throws SQLException {
        try {
            connection.setSchema(defaultTenant);
        } finally {
            connection.close();
        }
    }

    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return false;
    }

    @Override
    public <T> T unwrap(Class<T> unwrapType) {
        throw new UnknownUnwrapTypeException(unwrapType);
    }

    private String resolveTenant(String tenantIdentifier) {
        if (tenantIdentifier == null) {
            return defaultTenant;
        }
        String normalized = tenantIdentifier.trim().toLowerCase();
        return allowedTenants.contains(normalized) ? normalized : defaultTenant;
    }
}
