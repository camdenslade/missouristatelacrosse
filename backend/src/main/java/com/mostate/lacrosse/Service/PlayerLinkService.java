package com.mostate.lacrosse.Service;

import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.PlayerProfile;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;

/**
 * Self-heals a season row's account linkage (profileId, userUid) and email. Shared by
 * PlayersController (runs per-row whenever an authorized caller views that player) and
 * PlayerLinkRepairJob (runs a full sweep so existing broken links get fixed without waiting
 * for someone to view each row).
 */
@Service
public class PlayerLinkService {
    private final PlayerRepository repository;
    private final PlayerProfileService profileService;
    private final UserAccountRepository userAccountRepository;

    public PlayerLinkService(
        PlayerRepository repository,
        PlayerProfileService profileService,
        UserAccountRepository userAccountRepository
    ) {
        this.repository = repository;
        this.profileService = profileService;
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * Three passes:
     *   1. Resolve profileId if missing — by this row's own email if it has one, else by
     *      finding any other season row with the exact same name that already has a
     *      profileId and adopting it.
     *   2. Resolve/backfill this row's own userUid if missing — from the profile's
     *      firebaseUid (fast path), else from any sibling row sharing the resolved
     *      profileId, else any other row sharing the exact same name. Covers the case where
     *      a player genuinely has an account, it's just never been linked to this specific
     *      season's row (self-access, not just email display, depends on this).
     *   3. Backfill this row's own email if missing — from the profile (fast path), then
     *      sibling rows (by profileId, then by name), then — new — the UserAccount attached
     *      to the userUid resolved in pass 2, since a player can have a real account/email
     *      captured at signup that was never copied onto any Player row's own email field.
     * Persists whatever it resolves. Returns true if the row was changed.
     */
    public boolean autoLinkProfileAndEmail(Player player) {
        boolean changed = false;

        if (player.getProfileId() == null) {
            PlayerProfile profile = (player.getEmail() != null && !player.getEmail().isBlank())
                ? profileService.findOrCreateByEmail(player.getEmail(), player.getName())
                : null;
            if (profile == null && player.getName() != null && !player.getName().isBlank()) {
                UUID siblingProfileId = repository.findAllByNameIgnoreCase(player.getName()).stream()
                    .filter(p -> !p.getId().equals(player.getId()))
                    .map(Player::getProfileId)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
                if (siblingProfileId != null) {
                    profile = profileService.findById(siblingProfileId);
                }
            }
            if (profile != null) {
                player.setProfileId(profile.getId());
                changed = true;
            }
        }

        if (player.getUserUid() == null || player.getUserUid().isBlank()) {
            String foundUid = null;
            if (player.getProfileId() != null) {
                PlayerProfile profile = profileService.findById(player.getProfileId());
                if (profile != null && profile.getFirebaseUid() != null && !profile.getFirebaseUid().isBlank()) {
                    foundUid = profile.getFirebaseUid();
                }
                if (foundUid == null) {
                    foundUid = repository.findAllByProfileId(player.getProfileId()).stream()
                        .map(Player::getUserUid)
                        .filter(u -> u != null && !u.isBlank())
                        .findFirst()
                        .orElse(null);
                }
            }
            if (foundUid == null && player.getName() != null && !player.getName().isBlank()) {
                foundUid = repository.findAllByNameIgnoreCase(player.getName()).stream()
                    .filter(p -> !p.getId().equals(player.getId()))
                    .map(Player::getUserUid)
                    .filter(u -> u != null && !u.isBlank())
                    .findFirst()
                    .orElse(null);
            }
            if (foundUid != null && !foundUid.isBlank()) {
                player.setUserUid(foundUid);
                changed = true;
                if (player.getProfileId() != null) {
                    profileService.setFirebaseUid(player.getProfileId(), foundUid);
                }
            }
        }

        if (player.getEmail() == null || player.getEmail().isBlank()) {
            String foundEmail = null;
            if (player.getProfileId() != null) {
                foundEmail = profileService.getEmail(player.getProfileId());
                if (foundEmail == null || foundEmail.isBlank()) {
                    foundEmail = repository.findAllByProfileId(player.getProfileId()).stream()
                        .map(Player::getEmail)
                        .filter(e -> e != null && !e.isBlank())
                        .findFirst()
                        .orElse(null);
                }
            }
            if ((foundEmail == null || foundEmail.isBlank())
                    && player.getName() != null && !player.getName().isBlank()) {
                foundEmail = repository.findAllByNameIgnoreCase(player.getName()).stream()
                    .filter(p -> !p.getId().equals(player.getId()))
                    .map(Player::getEmail)
                    .filter(e -> e != null && !e.isBlank())
                    .findFirst()
                    .orElse(null);
            }
            if ((foundEmail == null || foundEmail.isBlank())
                    && player.getUserUid() != null && !player.getUserUid().isBlank()) {
                // Last resort: the player's actual account, in case an email was captured at
                // signup/self-claim but never copied onto any Player row's own email field.
                foundEmail = userAccountRepository.findByFirebaseUid(player.getUserUid())
                    .map(UserAccount::getEmail)
                    .filter(e -> e != null && !e.isBlank())
                    .orElse(null);
            }
            if (foundEmail != null && !foundEmail.isBlank()) {
                player.setEmail(foundEmail);
                changed = true;
                if (player.getProfileId() != null) {
                    profileService.setEmail(player.getProfileId(), foundEmail);
                }
            }
        }

        if (changed) {
            repository.save(player);
        }
        return changed;
    }
}
