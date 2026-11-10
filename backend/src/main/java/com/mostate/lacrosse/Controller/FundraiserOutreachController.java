package com.mostate.lacrosse.Controller;

import java.time.Instant;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Config.FirebaseAdminFilter;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.FundraiserOutreachService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import com.mostate.lacrosse.Service.SeasonService;
import jakarta.servlet.http.HttpServletRequest;

/** Endpoints for fundraiser outreach: player links and contacts, the leaderboard, and the board's controls. */
@RestController
@RequestMapping("/api/fundraisers/outreach")
public class FundraiserOutreachController {
    private final FundraiserOutreachService outreach;
    private final PlayerRepository playerRepo;
    private final PlayerProfileService profileService;
    private final AuthorizationService authorizationService;
    private final SeasonService seasonService;

    public FundraiserOutreachController(
        FundraiserOutreachService outreach,
        PlayerRepository playerRepo,
        PlayerProfileService profileService,
        AuthorizationService authorizationService,
        SeasonService seasonService
    ) {
        this.outreach = outreach;
        this.playerRepo = playerRepo;
        this.profileService = profileService;
        this.authorizationService = authorizationService;
        this.seasonService = seasonService;
    }

    private boolean isBoard(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isBoardOrAbove(uid, program, token);
    }

    private boolean isSelfOrBoard(HttpServletRequest request, Player player, String program) {
        if (isBoard(request, program)) return true;
        String uid = (String) request.getAttribute("firebaseUid");
        return uid != null && (profileService.isSelf(player, uid) || profileService.isLinkedParent(player, uid));
    }

    // Public

    @GetMapping("/active")
    public ResponseEntity<?> active() {
        return ResponseEntity.ok(outreach.activeCampaigns());
    }

    /** Fundraiser page: who a shared link belongs to, and the leaderboard. */
    @GetMapping("/slug/{slug}")
    public ResponseEntity<?> publicView(@PathVariable String slug, @RequestParam(required = false) String ref) {
        Map<String, Object> f = outreach.findFundraiserBySlug(slug);
        if (f == null) return ResponseEntity.notFound().build();
        Map<String, Object> body = new HashMap<>();
        body.put("outreachEnabled", f.get("outreach_enabled"));
        body.put("supporting", outreach.playerNameForCode(ref));
        body.put("leaderboard", Boolean.TRUE.equals(f.get("outreach_enabled")) ? outreach.leaderboard((UUID) f.get("id")) : List.of());
        return ResponseEntity.ok(body);
    }

    // Player (or a linked parent, or the board)

    @GetMapping("/{fundraiserId}/me")
    public ResponseEntity<?> me(
        HttpServletRequest request,
        @PathVariable UUID fundraiserId,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) return ResponseEntity.notFound().build();
        if (!isSelfOrBoard(request, player, program)) return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        Map<String, Object> f = outreach.findFundraiser(fundraiserId);
        if (f == null) return ResponseEntity.notFound().build();
        String code = outreach.codeFor(playerId);
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("shareUrl", outreach.siteBase() + "/fundraiser/" + f.get("slug") + "?ref=" + code);
        body.put("contacts", outreach.contactsFor(fundraiserId, playerId));
        body.put("raised", outreach.raisedBy(fundraiserId, playerId));
        body.put("launchAt", f.get("outreach_launch_at"));
        body.put("maxContacts", FundraiserOutreachService.MAX_CONTACTS_PER_PLAYER);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{fundraiserId}/contacts")
    public ResponseEntity<?> addContacts(
        HttpServletRequest request,
        @PathVariable UUID fundraiserId,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody List<Map<String, String>> contacts
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) return ResponseEntity.notFound().build();
        if (!isSelfOrBoard(request, player, program)) return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        if (outreach.findFundraiser(fundraiserId) == null) return ResponseEntity.notFound().build();
        if (contacts == null || contacts.size() > 100) return ResponseEntity.badRequest().body(new ErrorResponse("Add up to 100 contacts at a time"));
        FundraiserOutreachService.AddResult result = outreach.addContacts(fundraiserId, playerId, contacts);
        // Contacts added after launch go out on the next send pass instead of waiting for it.
        return ResponseEntity.ok(Map.of("added", result.added(), "skipped", result.skipped()));
    }

    @DeleteMapping("/{fundraiserId}/contacts/{contactId}")
    public ResponseEntity<?> removeContact(
        HttpServletRequest request,
        @PathVariable UUID fundraiserId,
        @PathVariable UUID contactId,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) return ResponseEntity.notFound().build();
        if (!isSelfOrBoard(request, player, program)) return ResponseEntity.status(403).body(new ErrorResponse("Not authorized"));
        return outreach.removeContact(fundraiserId, playerId, contactId)
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }

    // Board

    @GetMapping("/{fundraiserId}/board")
    public ResponseEntity<?> board(
        HttpServletRequest request,
        @PathVariable UUID fundraiserId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        Map<String, Object> f = outreach.findFundraiser(fundraiserId);
        if (f == null) return ResponseEntity.notFound().build();
        Map<String, Object> body = new HashMap<>();
        body.put("enabled", f.get("outreach_enabled"));
        body.put("launchAt", f.get("outreach_launch_at"));
        body.put("players", outreach.participation(fundraiserId, seasonService.getActiveCode()));
        return ResponseEntity.ok(body);
    }

    public record SettingsRequest(Boolean enabled, String launchAt) {}

    @PutMapping("/{fundraiserId}/settings")
    public ResponseEntity<?> settings(
        HttpServletRequest request,
        @PathVariable UUID fundraiserId,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody SettingsRequest body
    ) {
        if (!isBoard(request, program)) return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        if (outreach.findFundraiser(fundraiserId) == null) return ResponseEntity.notFound().build();
        Instant launchAt = null;
        boolean clear = body.launchAt() != null && body.launchAt().isBlank();
        if (body.launchAt() != null && !body.launchAt().isBlank()) {
            try {
                launchAt = Instant.parse(body.launchAt());
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Invalid launch time"));
            }
        }
        outreach.updateSettings(fundraiserId, body.enabled(), launchAt, clear);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Launches now: sets the launch time to now and sends everything that's due immediately. */
    @PostMapping("/{fundraiserId}/send-now")
    public ResponseEntity<?> sendNow(
        HttpServletRequest request,
        @PathVariable UUID fundraiserId,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isBoard(request, program)) return ResponseEntity.status(403).body(new ErrorResponse("Board access required"));
        Map<String, Object> f = outreach.findFundraiser(fundraiserId);
        if (f == null) return ResponseEntity.notFound().build();
        if (!Boolean.TRUE.equals(f.get("outreach_enabled"))) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Turn on player outreach first"));
        }
        Object launch = f.get("outreach_launch_at");
        if (launch == null || ((java.sql.Timestamp) launch).toInstant().isAfter(Instant.now())) {
            outreach.updateSettings(fundraiserId, null, Instant.now(), false);
        }
        return ResponseEntity.ok(Map.of("sent", outreach.sendDueFor(fundraiserId)));
    }
}
