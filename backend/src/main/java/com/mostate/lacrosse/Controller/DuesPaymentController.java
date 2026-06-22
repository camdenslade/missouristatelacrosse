package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.DuesPayment;
import com.mostate.lacrosse.Model.Player;
import com.mostate.lacrosse.Repository.DuesPaymentRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;

@RestController
@RequestMapping("/api/dues-payments")
public class DuesPaymentController {

    private final DuesPaymentRepository repo;
    private final PlayerRepository playerRepo;

    public DuesPaymentController(DuesPaymentRepository repo, PlayerRepository playerRepo) {
        this.repo = repo;
        this.playerRepo = playerRepo;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam UUID playerId) {
        try {
            List<DuesPayment> entries = repo.findByPlayerIdOrderByCreatedAtDesc(playerId);
            return ResponseEntity.ok(entries);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody DuesPaymentRequest body) {
        try {
            Player player = playerRepo.findById(body.playerId()).orElse(null);
            if (player == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Player not found"));
            }

            BigDecimal amount = body.amount();
            String type = body.type() != null ? body.type().toUpperCase() : "PAYMENT";

            DuesPayment entry = new DuesPayment();
            entry.setPlayerId(body.playerId());
            entry.setAmount(amount);
            entry.setType(type);
            entry.setNote(body.note());
            entry.setPaidByUid(body.paidByUid());
            repo.save(entry);

            // Update player balance
            BigDecimal current = player.getBalance() != null ? player.getBalance() : BigDecimal.ZERO;
            BigDecimal newBalance = switch (type) {
                // Payments and credits reduce what the player owes
                case "PAYMENT", "CREDIT" -> current.subtract(amount);
                // Charges and explicit adjustments increase what the player owes
                case "CHARGE", "ADJUSTMENT" -> current.add(amount);
                default -> current.subtract(amount);
            };
            player.setBalance(newBalance);
            playerRepo.save(player);

            return ResponseEntity.ok(Map.of(
                "id", entry.getId(),
                "newBalance", newBalance
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    public record DuesPaymentRequest(
        UUID playerId,
        BigDecimal amount,
        String type,
        String note,
        String paidByUid
    ) {}
}
