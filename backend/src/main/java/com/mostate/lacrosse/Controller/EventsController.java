package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
import com.mostate.lacrosse.Utils.JsonUtils;
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
        String normalized = email.trim().toLowerCase();

        // Check if this email was listed as a teammate by someone already registered
        var byTeammate = registrationRepo.findByTeammateEmailAndEventIdAndPaidTrue(normalized, id);
        if (byTeammate.isPresent()) {
            EventRegistration r = byTeammate.get();
            return ResponseEntity.ok(new TeamCheckResponse(true, r.getTeamId(), r.getPayerName(), r.getPayerEmail()));
        }

        // Fallback: check if this email belongs to a payer who has a team (covers 2-person team joining)
        var byPayer = registrationRepo.findByPayerEmailAndEventIdAndPaidTrue(normalized, id);
        if (byPayer.isPresent() && byPayer.get().getTeamId() != null) {
            EventRegistration r = byPayer.get();
            return ResponseEntity.ok(new TeamCheckResponse(true, r.getTeamId(), r.getPayerName(), r.getPayerEmail()));
        }

        return ResponseEntity.ok(new TeamCheckResponse(false, null, null, null));
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

        String teamNameFieldId = findTeamNameFieldId(event);
        String normalizedTeamName = getNormalizedTeamName(payload.formData(), teamNameFieldId);

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
            } else if (normalizedTeamName != null) {
                resolvedTeamId = findTeamIdByNormalizedName(id, normalizedTeamName, teamNameFieldId);
            }
            if (resolvedTeamId == null) {
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

    @PostMapping("/admin/teams/backfill")
    public ResponseEntity<?> backfillTeams(@RequestBody BackfillTeamsRequest request) {
        List<UUID> eventIds = request.eventIds() != null ? new ArrayList<>(request.eventIds()) : new ArrayList<>();
        if (eventIds.isEmpty()) {
            eventIds = eventRepo.findAllByOrderByStartTimeAsc().stream().map(Event::getId).toList();
        }

        int totalUpdated = 0;
        int totalTeamsCreated = 0;
        Map<String, Integer> eventsUpdated = new LinkedHashMap<>();

        for (UUID eventId : eventIds) {
            Event event = eventRepo.findById(eventId).orElse(null);
            if (event == null || event.getTeamSize() <= 1) continue;
            String fieldId = findTeamNameFieldId(event);
            if (fieldId == null) continue;
            BackfillStats stats = backfillEventTeams(event, fieldId);
            if (stats.updated > 0) {
                eventsUpdated.put(event.getId().toString(), stats.updated);
            }
            totalUpdated += stats.updated;
            totalTeamsCreated += stats.teamsCreated;
        }

        return ResponseEntity.ok(Map.of(
            "registrationsUpdated", totalUpdated,
            "teamsCreated", totalTeamsCreated,
            "events", eventsUpdated
        ));
    }

    @PostMapping("/{eventId}/teams/pair")
    public ResponseEntity<?> pairTeam(
        @PathVariable UUID eventId,
        @RequestBody PairTeamRequest request
    ) {
        Event event = eventRepo.findById(eventId).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        if (event.getTeamSize() <= 1) {
            return ResponseEntity.badRequest().body("Event is not a team event");
        }
        List<UUID> registrationIds = request.registrationIds();
        if (registrationIds == null || registrationIds.isEmpty()) {
            return ResponseEntity.badRequest().body("registrationIds required");
        }
        String teamName = TextSanitizer.clean(request.teamName());
        if (teamName == null || teamName.isBlank()) {
            return ResponseEntity.badRequest().body("teamName is required");
        }

        String fieldId = findTeamNameFieldId(event);
        if (fieldId == null) {
            return ResponseEntity.badRequest().body("Team name field not configured");
        }

        List<EventRegistration> regs = registrationRepo.findAllById(registrationIds)
            .stream()
            .filter(reg -> eventId.equals(reg.getEventId()))
            .collect(Collectors.toList());
        if (regs.isEmpty()) {
            return ResponseEntity.badRequest().body("No matching registrations found");
        }

        UUID teamId = regs.stream()
            .map(EventRegistration::getTeamId)
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(createTeam(eventId));

        for (EventRegistration reg : regs) {
            reg.setTeamId(teamId);
            reg.setFormData(setTeamNameInFormData(reg.getFormData(), fieldId, teamName));
        }

        registrationRepo.saveAll(regs);
        evaluateTeamCompletion(teamId, event);

        return ResponseEntity.ok(Map.of(
            "teamId", teamId,
            "teamName", teamName,
            "registrations", regs.stream().map(EventRegistration::getId).toList()
        ));
    }

    @PostMapping("/{eventId}/teams/{teamId}/remind")
    public ResponseEntity<?> remindTeam(
        @PathVariable UUID eventId,
        @PathVariable UUID teamId,
        @RequestBody TeamReminderRequest request
    ) {
        Event event = eventRepo.findById(eventId).orElse(null);
        if (event == null) return ResponseEntity.notFound().build();
        EventTeam team = teamRepo.findById(teamId).orElse(null);
        if (team == null) return ResponseEntity.notFound().build();

        List<EventRegistration> members = registrationRepo.findAllByTeamId(teamId);
        if (members.isEmpty()) {
            return ResponseEntity.badRequest().body("Team has no registrations yet");
        }

        Set<String> registeredEmails = members.stream()
            .map(EventRegistration::getPayerEmail)
            .filter(Objects::nonNull)
            .map(email -> email.trim().toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());

        Set<String> pendingEmails = new LinkedHashSet<>();
        for (EventRegistration member : members) {
            for (String teammate : member.getTeammateEmails()) {
                if (teammate == null) continue;
                String trimmed = teammate.trim();
                if (trimmed.isEmpty()) continue;
                pendingEmails.add(trimmed);
            }
        }
        pendingEmails.removeIf(email -> registeredEmails.contains(email.toLowerCase(Locale.ROOT)));

        if (pendingEmails.isEmpty()) {
            return ResponseEntity.ok(Map.of("sentEmails", 0));
        }

        String program = request.program() != null ? request.program() : "men";
        Map<String, Object> prefill = buildPrefillData(members.get(0));
        String prefillJson = prefill.isEmpty() ? null : JsonUtils.toJson(prefill);
        String subject = "%s: Reminder to finish your team registration".formatted(event.getName());
        String teamNameFieldId = findTeamNameFieldId(event);
        String teamName = extractTeamName(members, teamNameFieldId);
        String captainName = members.get(0).getPayerName();
        String captainEmail = members.get(0).getPayerEmail();

        int sent = 0;
        for (String to : pendingEmails) {
            String link = buildTeamInviteLink(event, program, teamId, to, prefillJson);
            String body = buildTeamReminderBody(event, program, teamName, captainName, captainEmail, link);
            emailService.sendEmail(to, subject, body);
            sent++;
        }

        return ResponseEntity.ok(Map.of("sentEmails", sent));
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

    private static final java.time.Duration IMAGE_TTL = S3Service.IMAGE_TTL;

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

    private Map<String, Object> buildPrefillData(EventRegistration registration) {
        if (registration == null) return Map.of();
        Map<String, Object> raw = JsonUtils.readMap(registration.getFormData());
        if (raw.isEmpty()) return Map.of();
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : raw.entrySet()) {
            Object value = entry.getValue();
            if (value == null) continue;
            String stringValue = value.toString().trim();
            if (stringValue.isEmpty()) continue;
            copy.put(entry.getKey(), value);
        }
        return copy;
    }

    private String buildTeamInviteLink(
        Event event,
        String program,
        UUID teamId,
        String email,
        String prefillJson
    ) {
        StringBuilder builder = new StringBuilder(buildEventLink(event, program));
        builder.append("?teamId=").append(teamId);
        if (email != null && !email.isBlank()) {
            builder.append("&teammateEmail=").append(URLEncoder.encode(email, StandardCharsets.UTF_8));
        }
        if (prefillJson != null && !prefillJson.isBlank()) {
            builder.append("&prefill=").append(URLEncoder.encode(prefillJson, StandardCharsets.UTF_8));
        }
        return builder.toString();
    }

    private String findTeamNameFieldId(Event event) {
        if (event == null || event.getFields() == null) return null;
        for (Object obj : JsonUtils.readList(event.getFields())) {
            if (!(obj instanceof Map<?, ?> field)) continue;
            Object label = field.get("label");
            if (label == null || !label.toString().toLowerCase().contains("team name")) continue;
            Object id = field.get("id");
            if (id != null) return id.toString();
        }
        return null;
    }

    private static final Map<String, String> NUMBER_WORD_MAP = Map.ofEntries(
        Map.entry("zero", "0"),
        Map.entry("one", "1"),
        Map.entry("two", "2"),
        Map.entry("three", "3"),
        Map.entry("four", "4"),
        Map.entry("five", "5"),
        Map.entry("six", "6"),
        Map.entry("seven", "7"),
        Map.entry("eight", "8"),
        Map.entry("nine", "9"),
        Map.entry("ten", "10"),
        Map.entry("eleven", "11"),
        Map.entry("twelve", "12"),
        Map.entry("thirteen", "13"),
        Map.entry("fourteen", "14"),
        Map.entry("fifteen", "15"),
        Map.entry("sixteen", "16"),
        Map.entry("seventeen", "17"),
        Map.entry("eighteen", "18"),
        Map.entry("nineteen", "19"),
        Map.entry("twenty", "20")
    );

    private static final Pattern NUMBER_WORD_PATTERN = Pattern.compile(
        "\\b(" + String.join("|", NUMBER_WORD_MAP.keySet()) + ")\\b",
        Pattern.CASE_INSENSITIVE
    );

    private String getNormalizedTeamName(String formData, String fieldId) {
        String raw = getTeamNameFromFormData(formData, fieldId);
        return normalizeTeamNameForMatching(raw);
    }

    private BackfillStats backfillEventTeams(Event event, String fieldId) {
        List<EventRegistration> regs = registrationRepo.findAllByEventId(event.getId());
        Map<String, List<EventRegistration>> grouped = new LinkedHashMap<>();
        for (EventRegistration reg : regs) {
            String normalized = getNormalizedTeamName(reg.getFormData(), fieldId);
            if (normalized == null) continue;
            grouped.computeIfAbsent(normalized, key -> new ArrayList<>()).add(reg);
        }

        int updated = 0;
        int teamsCreated = 0;
        Set<UUID> canonicalIds = new LinkedHashSet<>();

        for (List<EventRegistration> bucket : grouped.values()) {
            if (bucket.isEmpty()) continue;
            UUID canonicalId = bucket.stream()
                .map(EventRegistration::getTeamId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
            if (canonicalId == null) {
                canonicalId = createTeam(event.getId());
                teamsCreated++;
            }
            canonicalIds.add(canonicalId);
            for (EventRegistration reg : bucket) {
                if (!canonicalId.equals(reg.getTeamId())) {
                    reg.setTeamId(canonicalId);
                    registrationRepo.save(reg);
                    updated++;
                }
            }
        }

        canonicalIds.forEach(teamId -> evaluateTeamCompletion(teamId, event));
        return new BackfillStats(updated, teamsCreated);
    }

    private static String getTeamNameFromFormData(String formData, String fieldId) {
        if (formData == null || fieldId == null) return null;
        Map<String, Object> data = JsonUtils.readMap(formData);
        Object value = data.get(fieldId);
        if (value == null) return null;
        String trimmed = value.toString().trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String setTeamNameInFormData(String formData, String fieldId, String teamName) {
        Map<String, Object> data = JsonUtils.readMap(formData);
        data.put(fieldId, teamName);
        return JsonUtils.toJson(data);
    }

    private static String normalizeTeamNameForMatching(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        String lower = trimmed.toLowerCase(Locale.ROOT);
        String replaced = replaceNumberWords(lower);
        String sanitized = replaced.replaceAll("[^a-z0-9]", "");
        return sanitized.isEmpty() ? null : sanitized;
    }

    private static String replaceNumberWords(String value) {
        Matcher matcher = NUMBER_WORD_PATTERN.matcher(value);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String replacement = NUMBER_WORD_MAP.get(matcher.group().toLowerCase(Locale.ROOT));
            matcher.appendReplacement(sb, replacement != null ? replacement : matcher.group());
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private UUID createTeam(UUID eventId) {
        EventTeam team = new EventTeam();
        team.setEventId(eventId);
        return teamRepo.save(team).getId();
    }

    private void evaluateTeamCompletion(UUID teamId, Event event) {
        if (teamId == null || event == null) return;
        long paidCount = registrationRepo.countByTeamIdAndPaidTrue(teamId);
        EventTeam team = teamRepo.findById(teamId).orElse(null);
        if (team == null) return;
        boolean shouldComplete = paidCount >= event.getTeamSize();
        if (team.isComplete() != shouldComplete) {
            team.setComplete(shouldComplete);
            teamRepo.save(team);
        }
    }

    private record BackfillStats(int updated, int teamsCreated) {}

    private UUID findTeamIdByNormalizedName(UUID eventId, String normalizedName, String fieldId) {
        if (normalizedName == null || fieldId == null) return null;
        for (EventRegistration reg : registrationRepo.findAllByEventId(eventId)) {
            if (reg.getTeamId() == null) continue;
            String existingName = getTeamNameFromFormData(reg.getFormData(), fieldId);
            String normalizedExisting = normalizeTeamNameForMatching(existingName);
            if (normalizedName.equals(normalizedExisting)) {
                return reg.getTeamId();
            }
        }
        return null;
    }

    private String extractTeamName(List<EventRegistration> members, String fieldId) {
        if (fieldId == null || members == null) return null;
        for (EventRegistration reg : members) {
            Map<String, Object> data = JsonUtils.readMap(reg.getFormData());
            Object value = data.get(fieldId);
            if (value == null) continue;
            String trimmed = value.toString().trim();
            if (!trimmed.isEmpty()) {
                return trimmed;
            }
        }
        return null;
    }

    private String buildTeamReminderBody(
        Event event,
        String program,
        String teamName,
        String captainName,
        String captainEmail,
        String link
    ) {
        String programLabel = programLabel(program);
        String identity = (captainName != null && !captainName.isBlank())
            ? captainName
            : (captainEmail != null && !captainEmail.isBlank() ? captainEmail : "A teammate");
        String teamText = teamName != null
            ? "Your team <strong>" + teamName + "</strong> still needs to finish registration for this event."
            : "Your team still needs to finish registration for this event.";
        String contact = (captainEmail != null && !captainEmail.isBlank())
            ? "<p>Have questions? Reply to " + captainEmail + ".</p>"
            : "";

        return "<div style='font-family:sans-serif;max-width:500px'>"
            + "<h2 style='color:#5E0009'>Missouri State Lacrosse</h2>"
            + "<p>Hi there,</p>"
            + "<p>" + identity + " has invited you to join Missouri State " + programLabel + " Lacrosse for "
            + "<strong>" + event.getName() + "</strong>.</p>"
            + "<p>" + teamText + "</p>"
            + "<p>The link below will pre-fill the team-specific info we already captured so you can finish fast:</p>"
            + "<p><a href='" + link + "'>Complete your registration</a></p>"
            + contact
            + "<p>Go Bears!</p>"
            + "</div>";
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

    public record TeamReminderRequest(
        String program
    ) {}

    public record BackfillTeamsRequest(
        List<UUID> eventIds
    ) {}

    public record PairTeamRequest(
        List<UUID> registrationIds,
        String teamName
    ) {}
}
