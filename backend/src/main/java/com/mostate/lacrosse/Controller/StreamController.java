package com.mostate.lacrosse.Controller;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.StreamKey;
import com.mostate.lacrosse.Repository.ChatMessageRepository;
import com.mostate.lacrosse.Repository.GameRepository;
import com.mostate.lacrosse.Repository.RaffleRepository;
import com.mostate.lacrosse.Repository.StreamKeyRepository;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.StreamKeyService;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/stream")
public class StreamController {

    private final StreamKeyService keyService;
    private final StreamKeyRepository keyRepo;
    private final GameRepository gameRepo;
    private final RaffleRepository raffleRepo;
    private final EmailService emailService;
    private final ChatMessageRepository chatRepo;

    public StreamController(
            StreamKeyService keyService,
            StreamKeyRepository keyRepo,
            GameRepository gameRepo,
            RaffleRepository raffleRepo,
            EmailService emailService,
            ChatMessageRepository chatRepo) {
        this.keyService   = keyService;
        this.keyRepo      = keyRepo;
        this.gameRepo     = gameRepo;
        this.raffleRepo   = raffleRepo;
        this.emailService = emailService;
        this.chatRepo     = chatRepo;
    }

    // ── Admin: set up RTMP stream for a game ──────────────────────────────────

    @PostMapping("/setup")
    public ResponseEntity<?> setup(@RequestBody SetupRequest req) {
        try {
            var game = gameRepo.findById(UUID.fromString(req.gameId())).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = new HashMap<>(JsonUtils.readMap(game.getData()));

            // Generate stream key if not already set
            if (data.get("streamKey") == null) {
                String streamKey = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                data.put("streamKey", streamKey);
                data.put("rtmpsUrl",  "rtmp://api.missouristatelacrosse.com/live");
                data.put("rtmpsKey",  streamKey);
                data.put("hlsUrl",    "https://api.missouristatelacrosse.com/hls/live/" + streamKey + "/index.m3u8");
            }

            data.put("isPaywalled",    req.isPaywalled());
            data.put("saveAsVideo",    req.saveAsVideo());
            data.put("priceOneScreen", req.priceOneScreen());
            data.put("priceTwoScreen", req.priceTwoScreen());
            data.put("isLive",         false);

            game.setData(JsonUtils.toJson(data));
            gameRepo.save(game);

            return ResponseEntity.ok(Map.of(
                "streamKey",     data.get("streamKey"),
                "rtmpsUrl",      data.get("rtmpsUrl"),
                "rtmpsKey",      data.get("rtmpsKey"),
                "hlsUrl",        data.get("hlsUrl"),
                "isPaywalled",   data.get("isPaywalled"),
                "priceOneScreen",data.get("priceOneScreen"),
                "priceTwoScreen",data.get("priceTwoScreen")
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Admin: force-reset stream for a game (clears stream key) ─────────────

    @PostMapping("/admin/reset/{gameId}")
    public ResponseEntity<?> resetStream(@PathVariable String gameId) {
        try {
            var game = gameRepo.findById(UUID.fromString(gameId)).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = new HashMap<>(JsonUtils.readMap(game.getData()));
            String oldKey = (String) data.get("streamKey");

            data.remove("streamKey");
            data.remove("rtmpsUrl");
            data.remove("rtmpsKey");
            data.remove("hlsUrl");
            data.remove("isLive");

            game.setData(JsonUtils.toJson(data));
            gameRepo.save(game);

            return ResponseEntity.ok(Map.of(
                "message",    "Stream reset. Run /setup again to create a fresh stream key.",
                "clearedKey", oldKey != null ? oldKey : "none"
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Admin: update paywall config on the fly ───────────────────────────────

    @PutMapping("/config/{gameId}")
    public ResponseEntity<?> updateConfig(
            @PathVariable String gameId,
            @RequestBody PaywallConfigRequest req) {
        try {
            var game = gameRepo.findById(UUID.fromString(gameId)).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = new HashMap<>(JsonUtils.readMap(game.getData()));
            data.put("isPaywalled", req.isPaywalled());
            if (req.priceOneScreen() != null) data.put("priceOneScreen", req.priceOneScreen());
            if (req.priceTwoScreen() != null) data.put("priceTwoScreen", req.priceTwoScreen());
            game.setData(JsonUtils.toJson(data));
            gameRepo.save(game);

            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Admin: toggle isLive ──────────────────────────────────────────────────

    @PostMapping("/go-live/{gameId}")
    public ResponseEntity<?> toggleLive(
            @PathVariable String gameId,
            @RequestBody ToggleLiveRequest req) {
        try {
            var game = gameRepo.findById(UUID.fromString(gameId)).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            // When going live, clear isLive from all other games first
            if (req.isLive()) {
                for (var other : gameRepo.findAllLive()) {
                    if (!other.getId().equals(game.getId())) {
                        Map<String, Object> otherData = new HashMap<>(JsonUtils.readMap(other.getData()));
                        otherData.put("isLive", false);
                        other.setData(JsonUtils.toJson(otherData));
                        gameRepo.save(other);
                    }
                }
            }

            Map<String, Object> data = new HashMap<>(JsonUtils.readMap(game.getData()));
            data.put("isLive", req.isLive());
            if (req.isLive()) {
                data.put("status", "live");
            } else {
                data.remove("status"); // clear "live" so viewers stop seeing the stream UI
            }
            game.setData(JsonUtils.toJson(data));
            gameRepo.save(game);

            return ResponseEntity.ok(Map.of("isLive", req.isLive()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Admin: get stream config + keys ───────────────────────────────────────

    @GetMapping("/admin/{gameId}")
    public ResponseEntity<?> getAdminInfo(@PathVariable String gameId) {
        try {
            var game = gameRepo.findById(UUID.fromString(gameId)).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = JsonUtils.readMap(game.getData());
            List<StreamKey> keys = keyRepo.findByGameIdOrderByCreatedAtDesc(gameId);

            List<Map<String, Object>> keyList = keys.stream().map(k -> {
                Instant cutoff = Instant.now().minus(90, ChronoUnit.SECONDS);
                long active = keyRepo.countActiveSessions(k.getId(), cutoff);
                Map<String, Object> m = new HashMap<>();
                m.put("id", k.getId().toString());
                m.put("keyCode", k.getKeyCode());
                m.put("tier", k.getTier());
                m.put("displayName", k.getDisplayName());
                m.put("email", k.getEmail());
                m.put("activeSessions", active);
                m.put("activatedAt", k.getActivatedAt());
                m.put("expiresAt", k.getExpiresAt());
                m.put("createdAt", k.getCreatedAt());
                return m;
            }).toList();

            return ResponseEntity.ok(Map.of(
                "streamConfig", data,
                "keys", keyList
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Admin: generate a free key ─────────────────────────────────────────────

    @PostMapping("/keys")
    public ResponseEntity<?> generateKey(@RequestBody GenerateKeyRequest req) {
        try {
            String name  = TextSanitizer.clean(req.displayName());
            String email = TextSanitizer.clean(req.email());

            StreamKey key = keyService.createKey(req.gameId(), req.tier(), name, email, null);

            // Build a game label and send the key by email
            var game = gameRepo.findById(UUID.fromString(req.gameId())).orElse(null);
            if (game != null) {
                String gameLabel = "vs " + game.getOpponent()
                        + (game.getDate() != null ? " (" + game.getDate().toString().substring(0, 10) + ")" : "");
                sendKeyEmail(email, name, key.getKeyCode(), req.tier(), gameLabel);
            }

            return ResponseEntity.ok(Map.of("keyCode", key.getKeyCode(), "id", key.getId().toString()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Admin: revoke key ─────────────────────────────────────────────────────

    @DeleteMapping("/keys/{id}")
    public ResponseEntity<?> revokeKey(@PathVariable UUID id) {
        keyService.revokeKey(id);
        return ResponseEntity.noContent().build();
    }

    // ── Admin: clear sessions for a key ──────────────────────────────────────

    @DeleteMapping("/keys/{id}/sessions")
    public ResponseEntity<?> clearSessions(@PathVariable UUID id) {
        keyService.clearSessions(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ── MediaMTX auth callback — called when OBS starts publishing ───────────
    // MediaMTX sends JSON: { "path": "{streamKey}", "action": "publish", ... }
    // Return 2xx to allow the stream, 4xx to deny it.

    @PostMapping("/rtmp/auth")
    public ResponseEntity<?> rtmpAuth(@RequestBody RtmpAuthRequest req) {
        if (!"publish".equals(req.action())) {
            return ResponseEntity.ok().build(); // allow read/playback
        }
        String rawPath = req.path() != null ? req.path().replaceFirst("^/+", "") : "";
        // Extract last segment: "live/abc123" → "abc123"
        String streamKey = rawPath.contains("/")
                ? rawPath.substring(rawPath.lastIndexOf('/') + 1)
                : rawPath;
        boolean valid = !streamKey.isBlank() && (gameRepo.findByStreamKey(streamKey).isPresent()
                || raffleRepo.existsByStreamKey(streamKey));
        return valid
                ? ResponseEntity.ok().build()
                : ResponseEntity.status(403).body(new ErrorResponse("Unknown stream key"));
    }

    // ── Public: post-PayPal purchase → issue key + send email ────────────────

    @PostMapping("/purchase")
    public ResponseEntity<?> purchase(@RequestBody PurchaseRequest req) {
        try {
            String name  = TextSanitizer.clean(req.displayName());
            String email = TextSanitizer.clean(req.email());

            StreamKey key = keyService.createKey(
                req.gameId(), req.tier(), name, email, req.paypalOrderId()
            );

            sendKeyEmail(email, name, key.getKeyCode(), req.tier(), req.gameLabel());

            return ResponseEntity.ok(Map.of("keyCode", key.getKeyCode()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Public: validate key → session token + HLS URL ───────────────────────

    @PostMapping("/validate")
    public ResponseEntity<?> validate(@RequestBody ValidateRequest req) {
        try {
            var game = gameRepo.findById(UUID.fromString(req.gameId())).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = JsonUtils.readMap(game.getData());
            String hlsUrl = (String) data.get("hlsUrl");
            if (hlsUrl == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Stream not configured"));
            }

            StreamKeyService.ValidationResult result =
                keyService.validateKey(req.keyCode(), req.gameId(), hlsUrl, Boolean.TRUE.equals(req.force()));

            return ResponseEntity.ok(Map.of(
                "sessionToken", result.sessionToken(),
                "signedUrl",    result.hlsUrl(),
                "displayName",  result.displayName(),
                "expiresAt",    result.expiresAt().toString()
            ));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(e.getReason()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Public: free game access → HLS URL without key ───────────────────────

    @PostMapping("/access/{gameId}")
    public ResponseEntity<?> freeAccess(@PathVariable String gameId) {
        try {
            var game = gameRepo.findById(UUID.fromString(gameId)).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = JsonUtils.readMap(game.getData());
            if (Boolean.TRUE.equals(data.get("isPaywalled"))) {
                return ResponseEntity.status(403).body(new ErrorResponse("Game requires a key"));
            }

            String hlsUrl = (String) data.get("hlsUrl");
            if (hlsUrl == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Stream not configured"));
            }

            return ResponseEntity.ok(Map.of("signedUrl", hlsUrl));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Public: heartbeat ─────────────────────────────────────────────────────

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody HeartbeatRequest req) {
        try {
            var game = gameRepo.findById(UUID.fromString(req.gameId())).orElse(null);
            if (game == null) return ResponseEntity.notFound().build();

            Map<String, Object> data = JsonUtils.readMap(game.getData());
            String hlsUrl = (String) data.get("hlsUrl");
            if (hlsUrl == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Stream not configured"));
            }

            String url = keyService.heartbeat(req.sessionToken(), hlsUrl);
            return ResponseEntity.ok(Map.of("signedUrl", url));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(e.getReason()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // ── Public: disconnect ────────────────────────────────────────────────────
    // sendBeacon only sends POST, so expose the same endpoint as POST too

    @DeleteMapping("/session")
    public ResponseEntity<?> disconnect(@RequestBody DisconnectRequest req) {
        keyService.disconnect(req.sessionToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/session/disconnect")
    public ResponseEntity<?> disconnectPost(@RequestBody DisconnectRequest req) {
        keyService.disconnect(req.sessionToken());
        return ResponseEntity.noContent().build();
    }

    // ── Public: get recent chat history ──────────────────────────────────────

    @GetMapping("/chat/{gameId}")
    public ResponseEntity<?> chatHistory(@PathVariable String gameId) {
        var msgs = chatRepo.findTop50ByGameIdAndDeletedFalseOrderByCreatedAtAsc(gameId);
        List<Map<String, Object>> result = msgs.stream().map(m -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", m.getId().toString());
            map.put("displayName", m.getDisplayName());
            map.put("message", m.getMessage());
            map.put("createdAt", m.getCreatedAt().toString());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    // ── Admin: delete chat message ────────────────────────────────────────────

    @DeleteMapping("/chat/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable UUID messageId) {
        chatRepo.findById(messageId).ifPresent(m -> {
            m.setDeleted(true);
            chatRepo.save(m);
        });
        return ResponseEntity.noContent().build();
    }

    // ── Email helper ──────────────────────────────────────────────────────────

    private void sendKeyEmail(String to, String name, String keyCode, String tier, String gameLabel) {
        String tierLabel = "TWO_SCREEN".equals(tier) ? "2-Screen" : "1-Screen";
        String subject   = "Your Missouri State Lacrosse Stream Key — " + gameLabel;
        String body      = "<div style='font-family:sans-serif;max-width:500px'>"
                + "<h2 style='color:#5E0009'>Missouri State Lacrosse</h2>"
                + "<p>Hi " + name + ",</p>"
                + "<p>Here is your stream access key for <strong>" + gameLabel + "</strong>:</p>"
                + "<div style='font-size:24px;font-weight:bold;letter-spacing:3px;"
                + "background:#f5f5f5;padding:16px;border-radius:8px;text-align:center'>"
                + keyCode + "</div>"
                + "<p><strong>Tier:</strong> " + tierLabel + "</p>"
                + "<p>Your key is valid for 10 hours from when you first use it. "
                + "Save this email in case you need to re-enter your key.</p>"
                + "<p>Go Bears!</p>"
                + "</div>";

        try {
            emailService.sendEmail(to, subject, body);
        } catch (Exception e) {
            System.err.println("Failed to send stream key email: " + e.getMessage());
        }
    }

    // ── Request records ───────────────────────────────────────────────────────

    public record SetupRequest(String gameId, boolean isPaywalled, boolean saveAsVideo, Double priceOneScreen, Double priceTwoScreen) {}
    public record PaywallConfigRequest(boolean isPaywalled, Double priceOneScreen, Double priceTwoScreen) {}
    public record ToggleLiveRequest(boolean isLive) {}
    public record GenerateKeyRequest(String gameId, String tier, String displayName, String email) {}
    public record PurchaseRequest(String gameId, String tier, String displayName, String email, String paypalOrderId, String gameLabel) {}
    public record ValidateRequest(String keyCode, String gameId, Boolean force) {}
    public record HeartbeatRequest(String sessionToken, String gameId) {}
    public record DisconnectRequest(String sessionToken) {}
    public record RtmpAuthRequest(String ip, String user, String password, String path, String protocol, String id, String action, String query) {}
}
