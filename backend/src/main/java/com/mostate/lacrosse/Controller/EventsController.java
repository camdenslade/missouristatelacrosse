package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Model.Event;
import com.mostate.lacrosse.Model.EventRegistration;
import com.mostate.lacrosse.Model.EventTeam;
import com.mostate.lacrosse.Repository.EventRegistrationRepository;
import com.mostate.lacrosse.Repository.EventRepository;
import com.mostate.lacrosse.Repository.EventTeamRepository;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.S3Service;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/events")
public class EventsController {

    private final EventRepository eventRepo;
    private final EventRegistrationRepository registrationRepo;
    private final EventTeamRepository teamRepo;
    private final PaymentReceiptRepository receiptRepo;
    private final EmailService emailService;
    private final S3Service s3Service;

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    public EventsController(
        EventRepository eventRepo,
        EventRegistrationRepository registrationRepo,
        EventTeamRepository teamRepo,
        PaymentReceiptRepository receiptRepo,
        EmailService emailService,
        S3Service s3Service
    ) {
        this.eventRepo = eventRepo;
        this.registrationRepo = registrationRepo;
        this.teamRepo = teamRepo;
        this.receiptRepo = receiptRepo;
        this.emailService = emailService;
        this.s3Service = s3Service;
    }

    // ── Public: list published events ─────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<EventResponse>> listPublished() {
        return ResponseEntity.ok(
            eventRepo.findByPublishedTrueOrderByStartTimeAsc().stream()
                .map(this::toResponse)
                .toList()
        );
    }

    // ── Public: get published event by slug ───────────────────────────────────

    @GetMapping("/slug/{slug}")
    public ResponseEntity<EventResponse> getBySlug(@PathVariable String slug) {
        return eventRepo.findBySlugAndPublishedTrue(slug)
            .map(e -> ResponseEntity.ok(toResponse(e)))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── Admin: list all events (including unpublished) ────────────────────────

    @GetMapping("/admin")
    public ResponseEntity<List<EventResponse>> listAll() {
        return ResponseEntity.ok(
            eventRepo.findAllByOrderByStartTimeAsc().stream()
                .map(this::toResponse)
                .toList()
        );
    }

    // ── Admin: create event ───────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<EventResponse> create(@RequestBody EventPayload payload) {
        Event event = new Event();
        applyPayload(event, payload);
        return ResponseEntity.ok(toResponse(eventRepo.save(event)));
    }

    // ── Admin: update event ───────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<EventResponse> update(
        @PathVariable UUID id,
        @RequestBody EventPayload payload
    ) {
        Event existing = eventRepo.findById(id).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();
        applyPayload(existing, payload);
        return ResponseEntity.ok(toResponse(eventRepo.save(existing)));
    }

    // ── Admin: delete event ───────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        eventRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Admin: get all registrations for an event ─────────────────────────────

    @GetMapping("/{id}/registrations")
    public ResponseEntity<List<RegistrationResponse>> registrations(@PathVariable UUID id) {
        List<EventRegistration> regs = registrationRepo.findAllByEventId(id);
        return ResponseEntity.ok(regs.stream().map(this::toRegResponse).toList());
    }

    // ── Public: check if a teammate slot exists for an email ──────────────────

    @GetMapping("/{id}/team-check")
    public ResponseEntity<TeamCheckResponse> teamCheck(
        @PathVariable UUID id,
        @RequestParam String email
    ) {
        return registrationRepo
            .findByTeammateEmailAndEventIdAndPaidTrue(email.trim().toLowerCase(), id)
            .map(r -> ResponseEntity.ok(new TeamCheckResponse(
                true, r.getTeamId(), r.getPayerName(), r.getPayerEmail()
            )))
            .orElse(ResponseEntity.ok(new TeamCheckResponse(false, null, null, null)));
    }

    // ── Public: submit registration after PayPal capture ─────────────────────

    @PostMapping("/{id}/register")
    public ResponseEntity<?> register(
        @PathVariable UUID id,
        @RequestBody RegistrationPayload payload,
        @RequestHeader(value = "X-Program", defaultValue = "men") String program
    ) {
        Event event = eventRepo.findById(id).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();

        // Validate that the PayPal order was actually captured (free events pass null)
        boolean isFree = event.getPrice() == null || event.getPrice().compareTo(BigDecimal.ZERO) == 0;
        if (!isFree) {
            if (payload.paypalOrderId() == null || payload.paypalOrderId().isBlank()) {
                return ResponseEntity.badRequest().body("paypalOrderId required for paid events");
            }
            boolean receiptFound = receiptRepo.findByOrderId(payload.paypalOrderId()).isPresent();
            if (!receiptFound) {
                return ResponseEntity.badRequest().body("Payment not found");
            }
        }

        // Resolve or create team for team events
        UUID resolvedTeamId = null;
        if (event.getTeamSize() > 1) {
            if (payload.teamId() != null) {
                // Person B joining an existing team
                resolvedTeamId = payload.teamId();
            } else {
                // Person A starting a new team
                EventTeam team = new EventTeam();
                team.setEventId(id);
                resolvedTeamId = teamRepo.save(team).getId();
            }
        }

        // Save registration
        EventRegistration reg = new EventRegistration();
        reg.setEventId(id);
        reg.setPayerName(payload.payerName() != null ? TextSanitizer.clean(payload.payerName()) : null);
        String normalizedPayerEmail = payload.payerEmail() != null ? payload.payerEmail().trim().toLowerCase() : null;
        reg.setPayerEmail(normalizedPayerEmail);
        reg.setPaypalOrderId(payload.paypalOrderId());
        reg.setAmountPaid(isFree ? BigDecimal.ZERO : event.getPrice());
        reg.setPaid(true);
        reg.setPaidAt(Instant.now());
        reg.setFormData(payload.formData() != null ? payload.formData() : "{}");
        reg.setTeamId(resolvedTeamId);

        List<String> teammateEmails = sanitizeTeammateEmails(payload.teammateEmails(), normalizedPayerEmail);
        reg.setTeammateEmails(teammateEmails);

        registrationRepo.save(reg);

        // Check if team is now complete
        if (resolvedTeamId != null) {
            long paidCount = registrationRepo.countByTeamIdAndPaidTrue(resolvedTeamId);
            if (paidCount >= event.getTeamSize()) {
                EventTeam team = teamRepo.findById(resolvedTeamId).orElse(null);
                if (team != null && !team.isComplete()) {
                    team.setComplete(true);
                    teamRepo.save(team);
                }
            }
        }

        notifyTeammates(event, program, reg.getPayerName(), reg.getPayerEmail(), teammateEmails);

        return ResponseEntity.ok(toRegResponse(reg));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyPayload(Event event, EventPayload payload) {
        if (payload.name() != null) {
            event.setName(TextSanitizer.clean(payload.name()));
        }
        // On create (no ID yet), generate a random alphanumeric slug
        if (event.getId() == null) {
            event.setSlug(UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        }
        if (payload.address() != null) {
            String addr = TextSanitizer.clean(payload.address());
            event.setAddress(addr);
            event.setMapsLink("https://www.google.com/maps/search/?api=1&query="
                + URLEncoder.encode(addr, StandardCharsets.UTF_8));
        }
        if (payload.startTime() != null) {
            event.setStartTime(Instant.parse(payload.startTime()));
        }
        if (payload.endTime() != null) {
            event.setEndTime(Instant.parse(payload.endTime()));
        }
        if (payload.description() != null) {
            event.setDescription(TextSanitizer.clean(payload.description()));
        }
        if (payload.fields() != null) {
            event.setFields(payload.fields());
        }
        if (payload.price() != null) {
            event.setPrice(payload.price());
        }
        if (payload.teamSize() != null) {
            event.setTeamSize(payload.teamSize());
        }
        if (payload.published() != null) {
            event.setPublished(payload.published());
        }
        if (payload.image() != null) {
            event.setImage(payload.image().isBlank() ? null : payload.image());
        }
    }

    private static final java.time.Duration IMAGE_TTL = java.time.Duration.ofMinutes(15);

    private EventResponse toResponse(Event e) {
        // Count registrations for this event
        long regCount = registrationRepo.findAllByEventId(e.getId()).size();
        return new EventResponse(
            e.getId(), e.getName(), e.getSlug(), e.getAddress(), e.getMapsLink(),
            e.getStartTime(), e.getEndTime(), e.getDescription(),
            s3Service.toPresignedUrl(e.getImage(), IMAGE_TTL),
            e.getFields(), e.getPrice(), e.getTeamSize(), e.isPublished(),
            regCount, e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private RegistrationResponse toRegResponse(EventRegistration r) {
        // Determine team completeness
        Boolean teamComplete = null;
        if (r.getTeamId() != null) {
            teamComplete = teamRepo.findById(r.getTeamId())
                .map(EventTeam::isComplete)
                .orElse(false);
        }
        return new RegistrationResponse(
            r.getId(), r.getEventId(), r.getPayerName(), r.getPayerEmail(),
            r.getPaypalOrderId(), r.getAmountPaid(), r.isPaid(), r.getPaidAt(),
            r.getFormData(), r.getTeamId(), r.getTeammateEmails(), teamComplete,
            r.getCreatedAt()
        );
    }

    private List<String> sanitizeTeammateEmails(List<String> emails, String payerEmail) {
        if (emails == null || emails.isEmpty()) {
            return List.of();
        }
        return emails.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(val -> !val.isBlank())
            .map(String::toLowerCase)
            .filter(val -> payerEmail == null || !val.equals(payerEmail))
            .distinct()
            .collect(Collectors.toList());
    }

    private void notifyTeammates(
        Event event,
        String program,
        String payerName,
        String payerEmail,
        List<String> teammateEmails
    ) {
        if (event == null || teammateEmails == null || teammateEmails.isEmpty()) {
            return;
        }
        String programLabel = programLabel(program);
        String link = buildEventLink(event, program);
        String identity = (payerName != null && !payerName.isBlank())
            ? payerName
            : (payerEmail != null && !payerEmail.isBlank() ? payerEmail : "A teammate");
        String contactLine = (payerEmail != null && !payerEmail.isBlank())
            ? "Have questions? Reply to " + payerEmail + "."
            : "";
        String contactSection = contactLine.isBlank() ? "" : contactLine + "\n\n";
        String subject = "%s Lacrosse: You're invited to join %s".formatted(programLabel, event.getName());
        String body = """
            Hi there,

            %s has registered for Missouri State %s Lacrosse and listed you as a teammate for %s.
            Complete your registration here:
            %s

            %s
            Go Bears!
            - Missouri State %s Lacrosse
            """.formatted(
            identity,
            programLabel,
            event.getName(),
            link,
            contactSection,
            programLabel
        );

        for (String to : teammateEmails) {
            if (to != null && !to.isBlank()) {
                emailService.sendEmail(to, subject, body);
            }
        }
    }

    private String buildEventLink(Event event, String program) {
        String base = frontendBaseUrl != null ? frontendBaseUrl.replaceAll("/+$", "") : "";
        String programPath = "women".equalsIgnoreCase(program) ? "/women" : "";
        StringBuilder link = new StringBuilder();
        if (!base.isEmpty()) {
            link.append(base);
        }
        link.append(programPath);
        link.append("/event-signup/");
        link.append(event.getSlug());
        return link.toString();
    }

    private String programLabel(String program) {
        return "women".equalsIgnoreCase(program) ? "Women's" : "Men's";
    }

    // ── Records ───────────────────────────────────────────────────────────────

    public record EventPayload(
        String name,
        String address,
        String startTime,
        String endTime,
        String description,
        String fields,
        BigDecimal price,
        Integer teamSize,
        Boolean published,
        String image
    ) {}

    public record EventResponse(
        UUID id,
        String name,
        String slug,
        String address,
        String mapsLink,
        Instant startTime,
        Instant endTime,
        String description,
        String image,
        String fields,
        BigDecimal price,
        int teamSize,
        boolean published,
        long registrationCount,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record RegistrationPayload(
        String paypalOrderId,
        String payerName,
        String payerEmail,
        String formData,
        List<String> teammateEmails,
        UUID teamId
    ) {}

    public record RegistrationResponse(
        UUID id,
        UUID eventId,
        String payerName,
        String payerEmail,
        String paypalOrderId,
        BigDecimal amountPaid,
        boolean paid,
        Instant paidAt,
        String formData,
        UUID teamId,
        List<String> teammateEmails,
        Boolean teamComplete,
        Instant createdAt
    ) {}

    public record TeamCheckResponse(
        boolean found,
        UUID teamId,
        String registrantName,
        String registrantEmail
    ) {}
}
