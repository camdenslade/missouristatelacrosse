package com.mostate.lacrosse.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Model.PlayerProfile;
import com.mostate.lacrosse.Repository.PlayerProfileRepository;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;

@Service
public class PlayerProfileService {
    private final PlayerProfileRepository repository;

    public PlayerProfileService(PlayerProfileRepository repository) {
        this.repository = repository;
    }

    public PlayerProfile findById(UUID id) {
        return repository.findById(id).orElse(null);
    }

    public String getParents(UUID profileId) {
        PlayerProfile profile = findById(profileId);
        return profile != null ? profile.getParents() : null;
    }

    public void setParents(UUID profileId, String parentsJson) {
        PlayerProfile profile = findById(profileId);
        if (profile == null) {
            return;
        }
        profile.setParents(parentsJson);
        repository.save(profile);
    }

    public String getEmail(UUID profileId) {
        PlayerProfile profile = findById(profileId);
        return profile != null ? profile.getEmail() : null;
    }

    public void setEmail(UUID profileId, String email) {
        PlayerProfile profile = findById(profileId);
        if (profile == null || email == null || email.isBlank()) {
            return;
        }
        profile.setEmail(email);
        repository.save(profile);
    }

    public void setFirebaseUid(UUID profileId, String firebaseUid) {
        PlayerProfile profile = findById(profileId);
        if (profile == null || firebaseUid == null || firebaseUid.isBlank()) {
            return;
        }
        // Only ever set once — never overwrite an existing link with a different uid, since
        // that would silently reassign this profile's identity to someone else.
        if (profile.getFirebaseUid() != null && !profile.getFirebaseUid().isBlank()) {
            return;
        }
        // Guards against PlayerLinkService's exact-name sibling fallback: two distinct
        // people sharing the same name (or a duplicate roster row) can otherwise cause this
        // profile to adopt a uid another profile already owns, which the DB's unique
        // constraint on firebase_uid would reject — better to just skip the ambiguous link
        // than 500 every caller that happens to read this player.
        boolean uidTakenElsewhere = repository.findByFirebaseUid(firebaseUid)
            .filter(other -> !other.getId().equals(profileId))
            .isPresent();
        if (uidTakenElsewhere) {
            return;
        }
        profile.setFirebaseUid(firebaseUid);
        repository.save(profile);
    }

    /**
     * True if `uid` is this player, checked via the row's own `userUid` first (season-scoped —
     * set at onboarding/self-claim time for that specific season's row), falling back to the
     * season-independent profile's `firebaseUid` when the row's own field is unset. Without
     * this fallback, a returning player whose new season's row was created without an explicit
     * `userUid` (e.g. via the Roster admin fuzzy-match "returning player" flow, which never
     * carries it forward) would lose access to their own dues/payment data every season until
     * an admin or the onboarding flow re-links them — same class of bug as the parents/email
     * fallbacks above.
     */
    public boolean isSelf(Player player, String uid) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        if (uid.equals(player.getUserUid())) {
            return true;
        }
        if (player.getProfileId() == null) {
            return false;
        }
        PlayerProfile profile = findById(player.getProfileId());
        return profile != null && uid.equals(profile.getFirebaseUid());
    }

    /**
     * True if `uid` is a linked parent of this player — checked via the season-independent
     * profile's parent list when the player has a profile, falling back to the player row's
     * own (season-scoped) parents field for legacy rows with no profile yet.
     */
    public boolean isLinkedParent(Player player, String uid) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        String parentsJson = player.getProfileId() != null ? getParents(player.getProfileId()) : null;
        if (parentsJson == null || parentsJson.isBlank()) {
            parentsJson = player.getParents();
        }
        if (parentsJson == null || parentsJson.isBlank()) {
            return false;
        }
        List<Map<String, Object>> parents = JsonUtils.readList(
            parentsJson,
            new TypeReference<List<Map<String, Object>>>() {}
        );
        return parents.stream().anyMatch(p -> uid.equals(String.valueOf(p.getOrDefault("uid", ""))));
    }

    public PlayerProfile findOrCreateByFirebaseUid(String firebaseUid, String name, String email) {
        String sanitizedUid = TextSanitizer.clean(firebaseUid);
        if (sanitizedUid == null || sanitizedUid.isBlank()) {
            return null;
        }
        String sanitizedName = TextSanitizer.clean(name);
        String sanitizedEmail = TextSanitizer.clean(email);
        return repository.findByFirebaseUid(sanitizedUid)
            .orElseGet(() -> createProfile(sanitizedUid, sanitizedName, sanitizedEmail, mergeKeyForUid(sanitizedUid)));
    }

    public PlayerProfile findOrCreateByEmail(String email, String name) {
        String sanitizedEmail = TextSanitizer.clean(email);
        if (sanitizedEmail == null || sanitizedEmail.isBlank()) {
            return null;
        }
        String mergeKey = mergeKeyForEmail(sanitizedEmail);
        return repository.findByMergeKey(mergeKey)
            .orElseGet(() -> createProfile(null, TextSanitizer.clean(name), sanitizedEmail, mergeKey));
    }

    public PlayerProfile findOrCreateByNameAndSchool(String name, String highSchool) {
        String sanitizedName = TextSanitizer.clean(name);
        String sanitizedSchool = TextSanitizer.clean(highSchool);
        if (sanitizedName == null || sanitizedName.isBlank() || sanitizedSchool == null || sanitizedSchool.isBlank()) {
            return null;
        }
        String mergeKey = mergeKeyForNameAndSchool(sanitizedName, sanitizedSchool);
        return repository.findByMergeKey(mergeKey)
            .orElseGet(() -> createProfile(null, sanitizedName, null, mergeKey));
    }

    private PlayerProfile createProfile(String firebaseUid, String name, String email, String mergeKey) {
        PlayerProfile profile = new PlayerProfile();
        profile.setFirebaseUid(TextSanitizer.clean(firebaseUid));
        profile.setName(TextSanitizer.clean(name));
        profile.setEmail(TextSanitizer.clean(email));
        profile.setMergeKey(TextSanitizer.clean(mergeKey));
        return repository.save(profile);
    }

    public static String mergeKeyForUid(String firebaseUid) {
        return "uid:" + firebaseUid;
    }

    public static String mergeKeyForEmail(String email) {
        String sanitized = TextSanitizer.clean(email);
        return "email:" + sanitized.toLowerCase(Locale.ROOT).trim();
    }

    public static String mergeKeyForNameAndSchool(String name, String highSchool) {
        String sanitizedName = TextSanitizer.clean(name);
        String sanitizedSchool = TextSanitizer.clean(highSchool);
        return "namehs:" + sanitizedName.toLowerCase(Locale.ROOT).trim()
            + "|" + sanitizedSchool.toLowerCase(Locale.ROOT).trim();
    }
}
