package com.mostate.lacrosse.Service;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.PlayerRepository;

/**
 * Stopgap for existing players whose season row was created before profile-linking (or the
 * fuzzy-match picker in RosterForm) existed — repairs profileId/email for every row in one
 * sweep instead of waiting for each row to happen to be viewed by an authorized caller
 * (PlayersController.toResponse already self-heals on view, but that only fixes what actually
 * gets looked at). Runs once immediately on startup (initialDelay = 0), then daily as a
 * safety net for anything that slips through going forward.
 */
@Service
public class PlayerLinkRepairJob {
    private static final Logger log = LoggerFactory.getLogger(PlayerLinkRepairJob.class);
    private static final List<String> TENANTS = List.of("men", "women");
    private static final long ONE_DAY_MS = 24L * 60 * 60 * 1000;

    private final PlayerRepository playerRepository;
    private final PlayerLinkService playerLinkService;

    public PlayerLinkRepairJob(PlayerRepository playerRepository, PlayerLinkService playerLinkService) {
        this.playerRepository = playerRepository;
        this.playerLinkService = playerLinkService;
    }

    @Scheduled(initialDelay = 0, fixedRate = ONE_DAY_MS)
    public void repairPlayerLinks() {
        for (String tenant : TENANTS) {
            TenantContext.setTenant(tenant);
            try {
                int repaired = 0;
                int failed = 0;
                for (Player player : playerRepository.findAll()) {
                    // One bad row must never abort the sweep for everyone after it — that
                    // would silently defeat the whole point of this job.
                    try {
                        if (playerLinkService.autoLinkProfileAndEmail(player)) {
                            repaired++;
                        }
                    } catch (Exception e) {
                        failed++;
                        log.warn("PlayerLinkRepairJob: failed to repair player {} in {}: {}",
                            player.getId(), tenant, e.getMessage());
                    }
                }
                if (repaired > 0 || failed > 0) {
                    log.info("PlayerLinkRepairJob: repaired {} player row(s) in {} ({} failed)",
                        repaired, tenant, failed);
                }
            } catch (Exception e) {
                log.error("PlayerLinkRepairJob: sweep failed for tenant {}: {}", tenant, e.getMessage(), e);
            } finally {
                TenantContext.clear();
            }
        }
    }
}
