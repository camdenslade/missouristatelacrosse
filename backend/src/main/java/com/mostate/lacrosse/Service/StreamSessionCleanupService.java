package com.mostate.lacrosse.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Repository.StreamSessionRepository;

@Service
public class StreamSessionCleanupService {

    private static final List<String> TENANTS = List.of("men", "women");
    private static final long STALE_AFTER_MINUTES = 60;

    private final StreamSessionRepository sessionRepo;
    private final TransactionTemplate txTemplate;

    public StreamSessionCleanupService(StreamSessionRepository sessionRepo,
                                       PlatformTransactionManager txManager) {
        this.sessionRepo = sessionRepo;
        // Each tenant gets its own transaction, opened AFTER TenantContext is set, so the
        // schema is bound correctly. A @Modifying delete needs an active transaction;
        // without one it throws TransactionRequiredException (this cleanup was silently
        // failing every hour before this fix).
        this.txTemplate = new TransactionTemplate(txManager);
    }

    @Scheduled(fixedRate = 60 * 60 * 1000)
    public void purgeExpiredSessions() {
        Instant cutoff = Instant.now().minus(STALE_AFTER_MINUTES, ChronoUnit.MINUTES);
        for (String tenant : TENANTS) {
            TenantContext.setTenant(tenant);
            try {
                txTemplate.executeWithoutResult(status -> sessionRepo.deleteExpiredSessions(cutoff));
            } finally {
                TenantContext.clear();
            }
        }
    }
}
