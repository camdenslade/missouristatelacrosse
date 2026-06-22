package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Model.Raffle;
import com.mostate.lacrosse.Model.RaffleEntry;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Repository.RaffleEntryRepository;
import com.mostate.lacrosse.Repository.RaffleRepository;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.JsonUtils;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/raffles")
public class RaffleController {

    private final RaffleRepository raffleRepo;
    private final RaffleEntryRepository entryRepo;
    private final PaymentReceiptRepository receiptRepo;
    private final S3Service s3Service;

    private static final java.time.Duration IMAGE_TTL = S3Service.IMAGE_TTL;

    public RaffleController(
        RaffleRepository raffleRepo,
        RaffleEntryRepository entryRepo,
        PaymentReceiptRepository receiptRepo,
        S3Service s3Service
    ) {
        this.raffleRepo = raffleRepo;
        this.entryRepo = entryRepo;
        this.receiptRepo = receiptRepo;
        this.s3Service = s3Service;
    }

    // ── Public: list published raffles ─────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<RaffleResponse>> listPublished() {
        return ResponseEntity.ok(
            raffleRepo.findByPublishedTrueOrderByCreatedAtDesc().stream()
                .map(r -> toResponse(r, false))
                .toList()
        );
    }

    // ── Public: get by slug ────────────────────────────────────────────────────

    @GetMapping("/slug/{slug}")
    public ResponseEntity<RaffleResponse> getBySlug(@PathVariable String slug) {
        return raffleRepo.findBySlugAndPublishedTrue(slug)
            .map(r -> ResponseEntity.ok(toResponse(r, false)))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── Admin: list all ────────────────────────────────────────────────────────

    @GetMapping("/admin")
    public ResponseEntity<List<RaffleResponse>> listAll() {
        return ResponseEntity.ok(
            raffleRepo.findAllByOrderByCreatedAtDesc().stream()
                .map(r -> toResponse(r, true))
                .toList()
        );
    }

    // ── Admin: create ──────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<RaffleResponse> create(@RequestBody RafflePayload payload) {
        Raffle raffle = new Raffle();
        applyPayload(raffle, payload, true);
        return ResponseEntity.ok(toResponse(raffleRepo.save(raffle), true));
    }

    // ── Admin: update ──────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<RaffleResponse> update(
        @PathVariable UUID id,
        @RequestBody RafflePayload payload
    ) {
        Raffle existing = raffleRepo.findById(id).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();
        applyPayload(existing, payload, false);
        return ResponseEntity.ok(toResponse(raffleRepo.save(existing), true));
    }

    // ── Admin: delete ──────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entryRepo.deleteAll(entryRepo.findAllByRaffleIdOrderByCreatedAtDesc(id));
        raffleRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Admin: get entries ─────────────────────────────────────────────────────

    @GetMapping("/{id}/entries")
    public ResponseEntity<List<EntryResponse>> entries(@PathVariable UUID id) {
        List<RaffleEntry> entries = entryRepo.findAllByRaffleIdOrderByCreatedAtDesc(id);
        return ResponseEntity.ok(entries.stream().map(this::toEntryResponse).toList());
    }

    // ── Admin: draw winner (ticket-based = random weighted, bid-based = highest)

    @PostMapping("/{id}/draw")
    public ResponseEntity<RaffleResponse> draw(@PathVariable UUID id) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();

        List<RaffleEntry> paid = entryRepo.findAllByRaffleIdOrderByCreatedAtDesc(id)
            .stream().filter(RaffleEntry::isPaid).toList();

        if (paid.isEmpty()) return ResponseEntity.badRequest().build();

        RaffleEntry winner;
        if (raffle.isAllowBids()) {
            // Highest bid wins
            winner = paid.stream()
                .max((a, b) -> {
                    BigDecimal ba = a.getBidAmount() != null ? a.getBidAmount() : BigDecimal.ZERO;
                    BigDecimal bb = b.getBidAmount() != null ? b.getBidAmount() : BigDecimal.ZERO;
                    return ba.compareTo(bb);
                })
                .orElse(paid.get(0));
        } else {
            // Weighted random by ticket count
            List<RaffleEntry> pool = new ArrayList<>();
            for (RaffleEntry e : paid) {
                for (int i = 0; i < Math.max(e.getTicketCount(), 1); i++) {
                    pool.add(e);
                }
            }
            winner = pool.get(new Random().nextInt(pool.size()));
        }

        raffle.setWinnerName(winner.getPayerName());
        raffle.setWinnerEmail(winner.getPayerEmail());
        raffle.setStatus("drawn");
        return ResponseEntity.ok(toResponse(raffleRepo.save(raffle), true));
    }

    // ── Admin: close raffle ────────────────────────────────────────────────────

    @PostMapping("/{id}/close")
    public ResponseEntity<RaffleResponse> close(@PathVariable UUID id) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();
        raffle.setStatus("closed");
        return ResponseEntity.ok(toResponse(raffleRepo.save(raffle), true));
    }

    // ── Admin: reopen raffle ───────────────────────────────────────────────────

    @PostMapping("/{id}/reopen")
    public ResponseEntity<RaffleResponse> reopen(@PathVariable UUID id) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();
        raffle.setStatus("active");
        raffle.setWinnerName(null);
        raffle.setWinnerEmail(null);
        return ResponseEntity.ok(toResponse(raffleRepo.save(raffle), true));
    }

    // ── Admin: set up stream for raffle drawing ────────────────────────────────

    @PostMapping("/{id}/stream/setup")
    public ResponseEntity<?> streamSetup(@PathVariable UUID id) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();

        Map<String, Object> sd = new HashMap<>(JsonUtils.readMap(raffle.getStreamData()));
        if (sd.get("streamKey") == null) {
            String key = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            sd.put("streamKey", key);
            sd.put("rtmpsUrl",  "rtmp://api.missouristatelacrosse.com/live");
            sd.put("hlsUrl",    "https://api.missouristatelacrosse.com/hls/live/" + key + "/index.m3u8");
            sd.put("isLive", false);
            raffle.setStreamData(JsonUtils.toJson(sd));
            raffleRepo.save(raffle);
        }
        return ResponseEntity.ok(toResponse(raffle, true));
    }

    // ── Admin: toggle go-live ──────────────────────────────────────────────────

    @PostMapping("/{id}/stream/go-live")
    public ResponseEntity<?> streamGoLive(@PathVariable UUID id) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();

        Map<String, Object> sd = new HashMap<>(JsonUtils.readMap(raffle.getStreamData()));
        if (sd.get("streamKey") == null) return ResponseEntity.badRequest().body("Stream not set up.");
        boolean nowLive = !Boolean.TRUE.equals(sd.get("isLive"));
        sd.put("isLive", nowLive);
        raffle.setStreamData(JsonUtils.toJson(sd));
        raffleRepo.save(raffle);
        return ResponseEntity.ok(toResponse(raffle, true));
    }

    // ── Public: get stream info (hls url + live status) ───────────────────────

    @GetMapping("/{id}/stream/info")
    public ResponseEntity<?> streamInfo(@PathVariable UUID id) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();
        Map<String, Object> sd = JsonUtils.readMap(raffle.getStreamData());
        boolean isLive = Boolean.TRUE.equals(sd.get("isLive"));
        String hlsUrl  = isLive ? (String) sd.get("hlsUrl") : null;
        return ResponseEntity.ok(Map.of("isLive", isLive, "hlsUrl", hlsUrl != null ? hlsUrl : ""));
    }

    // ── Admin: manual add entry (no payment required) ─────────────────────────

    @PostMapping("/{id}/admin-entry")
    public ResponseEntity<EntryResponse> adminAddEntry(
        @PathVariable UUID id,
        @RequestBody EntryPayload payload
    ) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();

        RaffleEntry entry = new RaffleEntry();
        entry.setRaffleId(id);
        entry.setPayerName(payload.payerName() != null ? TextSanitizer.clean(payload.payerName()) : null);
        entry.setPayerEmail(payload.payerEmail() != null ? payload.payerEmail().trim().toLowerCase() : null);
        entry.setPayerPhone(payload.payerPhone() != null ? payload.payerPhone().trim() : null);
        entry.setPaid(true);
        entry.setPaidAt(Instant.now());

        if (raffle.isAllowBids() && payload.bidAmount() != null) {
            entry.setBidAmount(payload.bidAmount());
            entry.setAmountPaid(payload.bidAmount());
            entry.setTicketCount(1);
        } else {
            int count = payload.ticketCount() != null ? Math.max(payload.ticketCount(), 1) : 1;
            entry.setTicketCount(count);
            BigDecimal price = raffle.getTicketPrice() != null ? raffle.getTicketPrice() : BigDecimal.ZERO;
            entry.setAmountPaid(price.multiply(BigDecimal.valueOf(count)));
        }

        entryRepo.save(entry);
        return ResponseEntity.ok(toEntryResponse(entry));
    }

    // ── Public: enter raffle ───────────────────────────────────────────────────

    @PostMapping("/{id}/enter")
    public ResponseEntity<?> enter(
        @PathVariable UUID id,
        @RequestBody EntryPayload payload
    ) {
        Raffle raffle = raffleRepo.findById(id).orElse(null);
        if (raffle == null) return ResponseEntity.notFound().build();
        if (!raffle.isPublished() || !"active".equals(raffle.getStatus())) {
            return ResponseEntity.badRequest().body("Raffle is not accepting entries.");
        }

        boolean isFree = raffle.getTicketPrice() == null
            || raffle.getTicketPrice().compareTo(BigDecimal.ZERO) == 0;

        if (!isFree) {
            if (payload.paypalOrderId() == null || payload.paypalOrderId().isBlank()) {
                return ResponseEntity.badRequest().body("paypalOrderId required.");
            }
            boolean receiptFound = receiptRepo.findByOrderId(payload.paypalOrderId()).isPresent();
            if (!receiptFound) {
                return ResponseEntity.badRequest().body("Payment not found.");
            }
        }

        RaffleEntry entry = new RaffleEntry();
        entry.setRaffleId(id);
        entry.setPayerName(payload.payerName() != null ? TextSanitizer.clean(payload.payerName()) : null);
        entry.setPayerEmail(payload.payerEmail() != null ? payload.payerEmail().trim().toLowerCase() : null);
        entry.setPayerPhone(payload.payerPhone() != null ? payload.payerPhone().trim() : null);
        entry.setPaypalOrderId(payload.paypalOrderId());
        entry.setPaid(true);
        entry.setPaidAt(Instant.now());

        if (raffle.isAllowBids() && payload.bidAmount() != null) {
            entry.setBidAmount(payload.bidAmount());
            entry.setAmountPaid(payload.bidAmount());
            entry.setTicketCount(1);
        } else {
            int count = payload.ticketCount() != null ? Math.max(payload.ticketCount(), 1) : 1;
            if (raffle.getMaxTicketsPerPerson() != null) {
                count = Math.min(count, raffle.getMaxTicketsPerPerson());
            }
            entry.setTicketCount(count);
            BigDecimal price = raffle.getTicketPrice() != null ? raffle.getTicketPrice() : BigDecimal.ZERO;
            entry.setAmountPaid(price.multiply(BigDecimal.valueOf(count)));
        }

        entryRepo.save(entry);
        return ResponseEntity.ok(toEntryResponse(entry));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyPayload(Raffle raffle, RafflePayload p, boolean isCreate) {
        if (p.name() != null) raffle.setName(TextSanitizer.clean(p.name()));
        if (isCreate) {
            raffle.setSlug(UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        }
        if (p.description() != null) raffle.setDescription(TextSanitizer.clean(p.description()));
        if (p.image() != null) raffle.setImage(p.image().isBlank() ? null : p.image());
        if (p.images() != null) {
            raffle.setImages(p.images().isEmpty() ? null : JsonUtils.toJson(p.images()));
            if (!p.images().isEmpty()) raffle.setImage(p.images().get(0));
        }
        if (p.ticketPrice() != null) raffle.setTicketPrice(p.ticketPrice());
        if (p.maxTicketsPerPerson() != null) raffle.setMaxTicketsPerPerson(p.maxTicketsPerPerson());
        if (p.allowBids() != null) raffle.setAllowBids(p.allowBids());
        if (p.published() != null) raffle.setPublished(p.published());
        if (p.status() != null) raffle.setStatus(p.status());
        if (p.endTime() != null) raffle.setEndTime(Instant.parse(p.endTime()));
        if (p.clearEndTime() != null && p.clearEndTime()) raffle.setEndTime(null);
        if (p.winnerName() != null) raffle.setWinnerName(p.winnerName().isBlank() ? null : p.winnerName());
        if (p.winnerEmail() != null) raffle.setWinnerEmail(p.winnerEmail().isBlank() ? null : p.winnerEmail());
    }

    private RaffleResponse toResponse(Raffle r, boolean includeAdmin) {
        long entryCount = includeAdmin ? entryRepo.countByRaffleIdAndPaidTrue(r.getId()) : 0;
        Map<String, Object> sd = JsonUtils.readMap(r.getStreamData());
        boolean isLive      = Boolean.TRUE.equals(sd.get("isLive"));
        String  hlsUrl      = (String) sd.get("hlsUrl");
        String  streamKey   = includeAdmin ? (String) sd.get("streamKey") : null;
        String  rtmpsUrl    = includeAdmin ? (String) sd.get("rtmpsUrl")  : null;
        List<String> rawImages = JsonUtils.readList(r.getImages(), new TypeReference<List<String>>() {});
        List<String> images = rawImages.stream()
            .map(url -> s3Service.toPresignedUrl(url, IMAGE_TTL))
            .toList();
        return new RaffleResponse(
            r.getId(), r.getName(), r.getSlug(), r.getDescription(),
            s3Service.toPresignedUrl(r.getImage(), IMAGE_TTL),
            r.getTicketPrice(), r.getMaxTicketsPerPerson(), r.isAllowBids(),
            r.isPublished(), r.getStatus(), r.getEndTime(),
            r.getWinnerName(), r.getWinnerEmail(),
            entryCount, r.getCreatedAt(), r.getUpdatedAt(),
            streamKey, rtmpsUrl, isLive ? hlsUrl : null, isLive, images
        );
    }

    private EntryResponse toEntryResponse(RaffleEntry e) {
        return new EntryResponse(
            e.getId(), e.getRaffleId(), e.getPayerName(), e.getPayerEmail(),
            e.getPayerPhone(), e.getPaypalOrderId(), e.getAmountPaid(), e.getTicketCount(),
            e.getBidAmount(), e.isPaid(), e.getPaidAt(), e.getCreatedAt()
        );
    }

    // ── Records ───────────────────────────────────────────────────────────────

    public record RafflePayload(
        String name,
        String description,
        String image,
        List<String> images,
        BigDecimal ticketPrice,
        Integer maxTicketsPerPerson,
        Boolean allowBids,
        Boolean published,
        String status,
        String endTime,
        Boolean clearEndTime,
        String winnerName,
        String winnerEmail
    ) {}

    public record RaffleResponse(
        UUID id,
        String name,
        String slug,
        String description,
        String image,
        BigDecimal ticketPrice,
        Integer maxTicketsPerPerson,
        boolean allowBids,
        boolean published,
        String status,
        Instant endTime,
        String winnerName,
        String winnerEmail,
        long entryCount,
        Instant createdAt,
        Instant updatedAt,
        String streamKey,
        String rtmpsUrl,
        String hlsUrl,
        boolean isLive,
        List<String> images
    ) {}

    public record EntryPayload(
        String payerName,
        String payerEmail,
        String payerPhone,
        String paypalOrderId,
        Integer ticketCount,
        BigDecimal bidAmount
    ) {}

    public record EntryResponse(
        UUID id,
        UUID raffleId,
        String payerName,
        String payerEmail,
        String payerPhone,
        String paypalOrderId,
        BigDecimal amountPaid,
        int ticketCount,
        BigDecimal bidAmount,
        boolean paid,
        Instant paidAt,
        Instant createdAt
    ) {}
}
