package com.mostate.lacrosse.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.mostate.lacrosse.Model.StreamKey;
import com.mostate.lacrosse.Model.StreamSession;
import com.mostate.lacrosse.Repository.StreamKeyRepository;
import com.mostate.lacrosse.Repository.StreamSessionRepository;

@Service
public class StreamKeyService {

    private static final int KEY_EXPIRY_HOURS = 10;
    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final StreamKeyRepository keyRepo;
    private final StreamSessionRepository sessionRepo;

    public StreamKeyService(
            StreamKeyRepository keyRepo,
            StreamSessionRepository sessionRepo) {
        this.keyRepo     = keyRepo;
        this.sessionRepo = sessionRepo;
    }

    public record ValidationResult(String sessionToken, String hlsUrl, String displayName, Instant expiresAt) {}

    public StreamKey createKey(
            String gameId,
            String tier,
            String displayName,
            String email,
            String paypalOrderId) {

        StreamKey key = new StreamKey();
        key.setGameId(gameId);
        key.setKeyCode(generateKeyCode(gameId));
        key.setTier(tier);
        key.setDisplayName(displayName);
        key.setEmail(email);
        key.setPaypalOrderId(paypalOrderId);
        return keyRepo.save(key);
    }

    @Transactional
    public ValidationResult validateKey(String keyCode, String gameId, String hlsUrl, boolean force) {
        StreamKey key = keyRepo.findByKeyCode(keyCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid key"));

        if (!key.getGameId().equals(gameId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Key not valid for this game");
        }

        // Activate on first use
        if (key.getActivatedAt() == null) {
            Instant now = Instant.now();
            key.setActivatedAt(now);
            key.setExpiresAt(now.plus(KEY_EXPIRY_HOURS, ChronoUnit.HOURS));
            keyRepo.save(key);
        } else if (Instant.now().isAfter(key.getExpiresAt())) {
            throw new ResponseStatusException(HttpStatus.GONE, "Key has expired");
        }

        // Enforce concurrent session limits
        int maxSessions = "TWO_SCREEN".equals(key.getTier()) ? 2 : 1;
        Instant sessionCutoff = Instant.now().minus(90, ChronoUnit.SECONDS);
        long active = keyRepo.countActiveSessions(key.getId(), sessionCutoff);
        if (active >= maxSessions) {
            if (force) {
                // Evict all existing sessions so the user can reconnect (e.g. after a page refresh)
                sessionRepo.deleteByKeyId(key.getId());
            } else {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Key is currently in use on another device");
            }
        }

        // Create session
        StreamSession session = new StreamSession();
        session.setKey(key);
        session.setSessionToken(UUID.randomUUID().toString());
        sessionRepo.save(session);

        return new ValidationResult(session.getSessionToken(), hlsUrl, key.getDisplayName(), key.getExpiresAt());
    }

    @Transactional
    public String heartbeat(String sessionToken, String hlsUrl) {
        StreamSession session = sessionRepo.findBySessionToken(sessionToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        StreamKey key = session.getKey();
        if (key.getExpiresAt() != null && Instant.now().isAfter(key.getExpiresAt())) {
            sessionRepo.delete(session);
            throw new ResponseStatusException(HttpStatus.GONE, "Key has expired");
        }

        session.setLastHeartbeat(Instant.now());
        sessionRepo.save(session);

        return hlsUrl;
    }

    @Transactional
    public void disconnect(String sessionToken) {
        sessionRepo.findBySessionToken(sessionToken)
                .ifPresent(sessionRepo::delete);
    }

    @Transactional
    public void revokeKey(UUID keyId) {
        keyRepo.deleteById(keyId);
    }

    @Transactional
    public void clearSessions(UUID keyId) {
        sessionRepo.deleteByKeyId(keyId);
    }

    private String generateKeyCode(String gameId) {
        String shortId = gameId.replace("-", "").substring(0, 6).toUpperCase();
        StringBuilder rand = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            rand.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
        }
        return "MSU-" + shortId + "-" + rand;
    }
}
