package com.mostate.lacrosse.Controller;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
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
import com.mostate.lacrosse.Model.PaymentCard;
import com.mostate.lacrosse.Model.PaymentCardStatus;
import com.mostate.lacrosse.Repository.PaymentCardRepository;
import com.mostate.lacrosse.Repository.PaymentCardStatusRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Service.AuthorizationService;
import com.mostate.lacrosse.Service.PlayerProfileService;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/payment-cards")
public class PaymentCardController {

    private final PaymentCardRepository cardRepo;
    private final PaymentCardStatusRepository statusRepo;
    private final PlayerRepository playerRepo;
    private final AuthorizationService authorizationService;
    private final PlayerProfileService profileService;

    public PaymentCardController(
        PaymentCardRepository cardRepo,
        PaymentCardStatusRepository statusRepo,
        PlayerRepository playerRepo,
        AuthorizationService authorizationService,
        PlayerProfileService profileService
    ) {
        this.cardRepo = cardRepo;
        this.statusRepo = statusRepo;
        this.playerRepo = playerRepo;
        this.authorizationService = authorizationService;
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<?> list(
        HttpServletRequest request,
        @RequestParam String season,
        @RequestParam(defaultValue = "men") String program
    ) {
        boolean admin = isAdmin(request, program);
        List<PaymentCard> cards = admin
            ? cardRepo.findBySeason(season)
            : cardRepo.findBySeasonAndActiveTrue(season);
        return ResponseEntity.ok(cards);
    }

    @PostMapping
    public ResponseEntity<?> create(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody PaymentCardRequest body
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        if (body.title() == null || body.title().isBlank() || body.season() == null || body.season().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Season and title are required"));
        }
        PaymentCard card = new PaymentCard();
        card.setSeason(body.season());
        card.setTitle(body.title());
        card.setDescription(body.description());
        card.setLink(body.link());
        card.setAmount(body.amount());
        card.setActive(body.active() == null || body.active());
        return ResponseEntity.ok(cardRepo.save(card));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody PaymentCardRequest body
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        PaymentCard card = cardRepo.findById(id).orElse(null);
        if (card == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Card not found"));
        }
        if (body.season() != null) card.setSeason(body.season());
        if (body.title() != null) card.setTitle(body.title());
        if (body.description() != null) card.setDescription(body.description());
        if (body.link() != null) card.setLink(body.link());
        if (body.amount() != null) card.setAmount(body.amount());
        if (body.active() != null) card.setActive(body.active());
        return ResponseEntity.ok(cardRepo.save(card));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        statusRepo.deleteByCardId(id);
        cardRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @GetMapping("/status")
    public ResponseEntity<?> statusForPlayer(
        HttpServletRequest request,
        @RequestParam UUID playerId,
        @RequestParam(defaultValue = "men") String program
    ) {
        Player player = playerRepo.findById(playerId).orElse(null);
        if (player == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
        }
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        return ResponseEntity.ok(statusRepo.findByPlayerId(playerId));
    }

    @PutMapping("/status")
    public ResponseEntity<?> upsertStatus(
        HttpServletRequest request,
        @RequestParam(defaultValue = "men") String program,
        @RequestBody StatusRequest body
    ) {
        Player player = playerRepo.findById(body.playerId()).orElse(null);
        if (player == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
        }
        if (!isSelfOrAdmin(request, player, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Not authorized for this player"));
        }
        if (cardRepo.findById(body.cardId()).isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Card not found"));
        }

        PaymentCardStatus status = statusRepo
            .findByCardIdAndPlayerId(body.cardId(), body.playerId())
            .orElseGet(PaymentCardStatus::new);
        status.setCardId(body.cardId());
        status.setPlayerId(body.playerId());
        status.setDone(body.done());
        status.setDoneAt(body.done() ? Instant.now() : null);
        status.setMarkedByUid((String) request.getAttribute("firebaseUid"));
        return ResponseEntity.ok(statusRepo.save(status));
    }

    @GetMapping("/{id}/completions")
    public ResponseEntity<?> completions(
        HttpServletRequest request,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "men") String program
    ) {
        if (!isAdmin(request, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }
        PaymentCard card = cardRepo.findById(id).orElse(null);
        if (card == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Card not found"));
        }
        List<Player> seasonPlayers = playerRepo.findAllBySeason(card.getSeason());
        Map<UUID, PaymentCardStatus> statusByPlayer = statusRepo.findByCardId(id).stream()
            .collect(Collectors.toMap(PaymentCardStatus::getPlayerId, s -> s));

        List<CompletionEntry> entries = seasonPlayers.stream()
            .map(p -> {
                PaymentCardStatus s = statusByPlayer.get(p.getId());
                return new CompletionEntry(
                    p.getId(),
                    p.getName(),
                    s != null && s.isDone(),
                    s != null ? s.getDoneAt() : null
                );
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(entries);
    }

    private boolean isAdmin(HttpServletRequest request, String program) {
        String uid = (String) request.getAttribute("firebaseUid");
        FirebaseToken token = (FirebaseToken) request.getAttribute(FirebaseAdminFilter.FIREBASE_TOKEN_ATTR);
        return authorizationService.isAdmin(uid, program, token);
    }

    private boolean isSelfOrAdmin(HttpServletRequest request, Player player, String program) {
        if (isAdmin(request, program)) {
            return true;
        }
        String uid = (String) request.getAttribute("firebaseUid");
        return profileService.isSelf(player, uid);
    }

    public record PaymentCardRequest(
        String season,
        String title,
        String description,
        String link,
        java.math.BigDecimal amount,
        Boolean active
    ) {}

    public record StatusRequest(
        UUID cardId,
        UUID playerId,
        boolean done
    ) {}

    public record CompletionEntry(
        UUID playerId,
        String playerName,
        boolean done,
        Instant doneAt
    ) {}
}
