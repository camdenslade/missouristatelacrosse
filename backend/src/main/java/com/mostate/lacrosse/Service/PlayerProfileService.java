package com.mostate.lacrosse.Service;

import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Model.PlayerProfile;
import com.mostate.lacrosse.Repository.PlayerProfileRepository;
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
