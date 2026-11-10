package com.mostate.lacrosse.Service;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Utils.EmailTemplate;

/**
 * Player-driven fundraiser outreach: share codes, donor contacts, the launch email and two
 * reminders, and crediting donations to the player whose link they came through. The tables
 * live in each program's schema; every query names the schema of the current tenant.
 */
@Service
public class FundraiserOutreachService {
    public static final int MAX_CONTACTS_PER_PLAYER = 40;
    // Launch email, then a reminder 4 days later and another 4 days after that.
    private static final int MAX_EMAILS_PER_CONTACT = 3;
    private static final String REMINDER_GAP = "4 days";
    private static final int SEND_BATCH = 150;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final String CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

    private final JdbcTemplate jdbc;
    private final EmailService emailService;
    private final SecureRandom random = new SecureRandom();

    @Value("${app.frontend.base-url:https://missouristatelacrosse.com}")
    private String frontendBaseUrl;

    public FundraiserOutreachService(JdbcTemplate jdbc, EmailService emailService) {
        this.jdbc = jdbc;
        this.emailService = emailService;
    }

    private static String schema() {
        return "women".equals(TenantContext.getTenant()) ? "women" : "men";
    }

    public String siteBase() {
        String base = frontendBaseUrl.replaceAll("/+$", "");
        return "women".equals(schema()) ? base + "/women" : base;
    }

    public Map<String, Object> findFundraiser(UUID fundraiserId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, title, slug, description, goal_amount, published, outreach_enabled, outreach_launch_at FROM "
                + schema() + ".fundraisers WHERE id = ?", fundraiserId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findFundraiserBySlug(String slug) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, title, slug, outreach_enabled, outreach_launch_at FROM " + schema() + ".fundraisers WHERE slug = ?", slug);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Published fundraisers that are running player outreach, newest first. */
    public List<Map<String, Object>> activeCampaigns() {
        return jdbc.queryForList(
            "SELECT id, title, slug, goal_amount, outreach_launch_at FROM " + schema()
                + ".fundraisers WHERE outreach_enabled AND published ORDER BY created_at DESC");
    }

    public void updateSettings(UUID fundraiserId, Boolean enabled, Instant launchAt, boolean clearLaunch) {
        if (enabled != null) {
            jdbc.update("UPDATE " + schema() + ".fundraisers SET outreach_enabled = ? WHERE id = ?", enabled, fundraiserId);
        }
        if (launchAt != null || clearLaunch) {
            jdbc.update("UPDATE " + schema() + ".fundraisers SET outreach_launch_at = ? WHERE id = ?",
                launchAt != null ? java.sql.Timestamp.from(launchAt) : null, fundraiserId);
        }
    }

    /** The player's share code, created the first time it's asked for. Codes are per player, reused across campaigns. */
    public String codeFor(UUID playerId) {
        List<String> existing = jdbc.queryForList(
            "SELECT code FROM " + schema() + ".fundraiser_player_codes WHERE player_id = ?", String.class, playerId);
        if (!existing.isEmpty()) return existing.get(0);
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = randomCode(6);
            try {
                jdbc.update("INSERT INTO " + schema() + ".fundraiser_player_codes (player_id, code) VALUES (?, ?)", playerId, code);
                return code;
            } catch (DuplicateKeyException e) {
                List<String> raced = jdbc.queryForList(
                    "SELECT code FROM " + schema() + ".fundraiser_player_codes WHERE player_id = ?", String.class, playerId);
                if (!raced.isEmpty()) return raced.get(0);
            }
        }
        throw new IllegalStateException("Could not create a share code");
    }

    private String randomCode(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        return sb.toString();
    }

    public List<Map<String, Object>> contactsFor(UUID fundraiserId, UUID playerId) {
        String s = schema();
        return jdbc.queryForList(
            "SELECT c.id, c.name, c.email, c.emails_sent, c.last_sent_at, c.created_at, "
                + " EXISTS (SELECT 1 FROM " + s + ".email_unsubscribes u WHERE u.email = lower(c.email)) AS unsubscribed, "
                + " EXISTS (SELECT 1 FROM " + s + ".fundraiser_referrals r JOIN " + s + ".payment_receipts p ON p.order_id = r.order_id "
                + "          WHERE r.contact_id = c.id AND p.status = 'COMPLETED' AND NOT p.voided) AS donated "
                + "FROM " + s + ".fundraiser_contacts c WHERE c.fundraiser_id = ? AND c.player_id = ? ORDER BY c.created_at",
            fundraiserId, playerId);
    }

    public record AddResult(int added, List<String> skipped) {}

    public AddResult addContacts(UUID fundraiserId, UUID playerId, List<Map<String, String>> contacts) {
        String s = schema();
        Integer have = jdbc.queryForObject(
            "SELECT count(*) FROM " + s + ".fundraiser_contacts WHERE fundraiser_id = ? AND player_id = ?",
            Integer.class, fundraiserId, playerId);
        int count = have != null ? have : 0;
        int added = 0;
        List<String> skipped = new ArrayList<>();
        for (Map<String, String> c : contacts) {
            String email = c.getOrDefault("email", "").trim().toLowerCase();
            String name = c.getOrDefault("name", "").trim();
            if (email.isEmpty()) continue;
            if (!EMAIL.matcher(email).matches() || email.length() > 254) {
                skipped.add(email + " (not a valid email)");
                continue;
            }
            if (count >= MAX_CONTACTS_PER_PLAYER) {
                skipped.add(email + " (limit of " + MAX_CONTACTS_PER_PLAYER + " reached)");
                continue;
            }
            try {
                jdbc.update("INSERT INTO " + s + ".fundraiser_contacts (fundraiser_id, player_id, name, email, token) VALUES (?, ?, ?, ?, ?)",
                    fundraiserId, playerId, name.isEmpty() ? null : name.substring(0, Math.min(name.length(), 80)), email,
                    UUID.randomUUID().toString().replace("-", ""));
                added++;
                count++;
            } catch (DuplicateKeyException e) {
                skipped.add(email + " (already added by you or a teammate)");
            }
        }
        return new AddResult(added, skipped);
    }

    public boolean removeContact(UUID fundraiserId, UUID playerId, UUID contactId) {
        return jdbc.update("DELETE FROM " + schema() + ".fundraiser_contacts WHERE id = ? AND fundraiser_id = ? AND player_id = ?",
            contactId, fundraiserId, playerId) == 1;
    }

    /** Opt-out from every outreach email this program sends, keyed by address. */
    public boolean unsubscribe(String token) {
        List<String> emails = jdbc.queryForList(
            "SELECT lower(email) FROM " + schema() + ".fundraiser_contacts WHERE token = ?", String.class, token);
        if (emails.isEmpty()) return false;
        jdbc.update("INSERT INTO " + schema() + ".email_unsubscribes (email) VALUES (?) ON CONFLICT DO NOTHING", emails.get(0));
        return true;
    }

    /**
     * Credits a checkout to a player when it's created from their link (and to the contact,
     * when it came from an outreach email). Bound before the donor pays, like the receipt's
     * source, so credit can't be claimed afterwards. Unknown codes are ignored.
     */
    public void recordReferral(String orderId, String source, String code, String contactToken) {
        if (orderId == null || source == null || !source.startsWith("fundraiser-")) return;
        boolean hasCode = code != null && !code.isBlank();
        boolean hasContact = contactToken != null && !contactToken.isBlank();
        if (!hasCode && !hasContact) return;
        String s = schema();
        Map<String, Object> fundraiser = findFundraiserBySlug(source.substring("fundraiser-".length()));
        if (fundraiser == null) return;
        UUID fundraiserId = (UUID) fundraiser.get("id");

        UUID contactId = null;
        UUID playerId = null;
        if (hasContact) {
            List<Map<String, Object>> contact = jdbc.queryForList(
                "SELECT id, player_id FROM " + s + ".fundraiser_contacts WHERE token = ? AND fundraiser_id = ?", contactToken, fundraiserId);
            if (!contact.isEmpty()) {
                contactId = (UUID) contact.get(0).get("id");
                playerId = (UUID) contact.get(0).get("player_id");
            }
        }
        if (playerId == null && hasCode) {
            List<UUID> byCode = jdbc.queryForList(
                "SELECT player_id FROM " + s + ".fundraiser_player_codes WHERE code = ?", UUID.class, code.trim().toLowerCase());
            if (!byCode.isEmpty()) playerId = byCode.get(0);
        }
        if (playerId == null) return;
        jdbc.update("INSERT INTO " + s + ".fundraiser_referrals (order_id, fundraiser_id, player_id, contact_id) VALUES (?, ?, ?, ?) "
            + "ON CONFLICT DO NOTHING", orderId, fundraiserId, playerId, contactId);
    }

    /** Players who have raised money through their link, highest first. */
    public List<Map<String, Object>> leaderboard(UUID fundraiserId) {
        String s = schema();
        return jdbc.queryForList(
            "SELECT pl.name, sum(p.amount) AS raised, count(*) AS donations "
                + "FROM " + s + ".fundraiser_referrals r "
                + "JOIN " + s + ".payment_receipts p ON p.order_id = r.order_id AND p.status = 'COMPLETED' AND NOT p.voided "
                + "JOIN " + s + ".players pl ON pl.id = r.player_id "
                + "WHERE r.fundraiser_id = ? GROUP BY pl.id, pl.name ORDER BY raised DESC, pl.name LIMIT 50",
            fundraiserId);
    }

    public BigDecimal raisedBy(UUID fundraiserId, UUID playerId) {
        String s = schema();
        BigDecimal total = jdbc.queryForObject(
            "SELECT coalesce(sum(p.amount), 0) FROM " + s + ".fundraiser_referrals r "
                + "JOIN " + s + ".payment_receipts p ON p.order_id = r.order_id AND p.status = 'COMPLETED' AND NOT p.voided "
                + "WHERE r.fundraiser_id = ? AND r.player_id = ?", BigDecimal.class, fundraiserId, playerId);
        return total != null ? total : BigDecimal.ZERO;
    }

    public String playerNameForCode(String code) {
        if (code == null || code.isBlank()) return null;
        List<String> names = jdbc.queryForList(
            "SELECT pl.name FROM " + schema() + ".fundraiser_player_codes c JOIN " + schema() + ".players pl ON pl.id = c.player_id "
                + "WHERE c.code = ?", String.class, code.trim().toLowerCase());
        return names.isEmpty() ? null : names.get(0);
    }

    /** Board view: every current-season player's participation in one campaign. */
    public List<Map<String, Object>> participation(UUID fundraiserId, String season) {
        String s = schema();
        return jdbc.queryForList(
            "SELECT pl.id AS player_id, pl.name, "
                + " (SELECT count(*) FROM " + s + ".fundraiser_contacts c WHERE c.fundraiser_id = ? AND c.player_id = pl.id) AS contacts, "
                + " (SELECT count(*) FROM " + s + ".fundraiser_contacts c WHERE c.fundraiser_id = ? AND c.player_id = pl.id AND c.emails_sent > 0) AS emailed, "
                + " (SELECT count(*) FROM " + s + ".fundraiser_referrals r JOIN " + s + ".payment_receipts p ON p.order_id = r.order_id "
                + "    WHERE r.fundraiser_id = ? AND r.player_id = pl.id AND p.status = 'COMPLETED' AND NOT p.voided) AS donations, "
                + " (SELECT coalesce(sum(p.amount), 0) FROM " + s + ".fundraiser_referrals r JOIN " + s + ".payment_receipts p ON p.order_id = r.order_id "
                + "    WHERE r.fundraiser_id = ? AND r.player_id = pl.id AND p.status = 'COMPLETED' AND NOT p.voided) AS raised "
                + "FROM " + s + ".players pl WHERE pl.season = ? ORDER BY pl.name",
            fundraiserId, fundraiserId, fundraiserId, fundraiserId, season);
    }

    // Sending

    @Scheduled(initialDelay = 120_000L, fixedDelay = 10 * 60_000L)
    public void sendDueEmails() {
        for (String tenant : List.of("men", "women")) {
            TenantContext.setTenant(tenant);
            try {
                for (Map<String, Object> f : jdbc.queryForList(
                        "SELECT id FROM " + schema() + ".fundraisers WHERE outreach_enabled AND published "
                            + "AND outreach_launch_at IS NOT NULL AND outreach_launch_at <= now()")) {
                    sendDueFor((UUID) f.get("id"));
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                TenantContext.clear();
            }
        }
    }

    /** Sends every launch email and reminder that's due for one campaign. Returns how many went out. */
    public int sendDueFor(UUID fundraiserId) {
        String s = schema();
        Map<String, Object> f = findFundraiser(fundraiserId);
        if (f == null) return 0;
        List<Map<String, Object>> due = jdbc.queryForList(
            "SELECT c.id, c.name, c.email, c.token, c.emails_sent, pl.name AS player_name, code.code "
                + "FROM " + s + ".fundraiser_contacts c "
                + "JOIN " + s + ".players pl ON pl.id = c.player_id "
                + "LEFT JOIN " + s + ".fundraiser_player_codes code ON code.player_id = c.player_id "
                + "WHERE c.fundraiser_id = ? "
                + "  AND (c.emails_sent = 0 OR (c.emails_sent < ? AND c.last_sent_at <= now() - interval '" + REMINDER_GAP + "')) "
                + "  AND NOT EXISTS (SELECT 1 FROM " + s + ".email_unsubscribes u WHERE u.email = lower(c.email)) "
                + "  AND NOT EXISTS (SELECT 1 FROM " + s + ".fundraiser_referrals r JOIN " + s + ".payment_receipts p ON p.order_id = r.order_id "
                + "                  WHERE r.contact_id = c.id AND p.status = 'COMPLETED' AND NOT p.voided) "
                + "ORDER BY c.created_at LIMIT " + SEND_BATCH,
            fundraiserId, MAX_EMAILS_PER_CONTACT);
        int sent = 0;
        for (Map<String, Object> c : due) {
            int previous = ((Number) c.get("emails_sent")).intValue();
            if (emailService.sendEmail((String) c.get("email"), subject(f, c, previous), body(f, c, previous))) {
                jdbc.update("UPDATE " + s + ".fundraiser_contacts SET emails_sent = emails_sent + 1, last_sent_at = now() WHERE id = ?",
                    c.get("id"));
                sent++;
            }
        }
        return sent;
    }

    private String subject(Map<String, Object> f, Map<String, Object> c, int previous) {
        String player = firstName((String) c.get("player_name"));
        return previous == 0
            ? player + " is asking for your support"
            : "Reminder: help " + player + " reach the team's goal";
    }

    private String body(Map<String, Object> f, Map<String, Object> c, int previous) {
        String base = siteBase();
        String player = esc((String) c.get("player_name"));
        String greeting = c.get("name") != null ? "Hi " + esc(firstName((String) c.get("name"))) + "," : "Hi,";
        String program = "women".equals(schema()) ? "Women's" : "Men's";
        String link = base + "/fundraiser/" + f.get("slug") + "?c=" + c.get("token")
            + (c.get("code") != null ? "&ref=" + c.get("code") : "");
        String unsubscribe = base + "/unsubscribe?t=" + c.get("token");
        String description = (String) f.get("description");
        StringBuilder html = new StringBuilder()
            .append(EmailTemplate.paragraph(greeting))
            .append(EmailTemplate.paragraph(previous == 0
                ? player + " plays for Missouri State " + program + " Lacrosse and is raising money for <strong>"
                    + esc((String) f.get("title")) + "</strong>. They added you because your support would mean a lot."
                : "Just a quick reminder that " + player + " is still raising money for <strong>"
                    + esc((String) f.get("title")) + "</strong>. Every gift, big or small, helps."));
        if (previous == 0 && description != null && !description.isBlank()) {
            html.append(EmailTemplate.paragraph(esc(description.length() > 400 ? description.substring(0, 400) + "..." : description)));
        }
        html.append(EmailTemplate.button(link, "Support " + esc(firstName((String) c.get("player_name")))))
            .append(EmailTemplate.paragraph("Missouri State Lacrosse is a registered 501(c)(3), so donations are tax deductible."))
            .append("<p style=\"font-size:12px;color:#888;margin-top:24px;\">You're getting this because "
                + player + " added your email to the team fundraiser. "
                + "<a href=\"" + unsubscribe + "\" style=\"color:#888;\">Unsubscribe</a></p>");
        return EmailTemplate.wrap(program, html.toString());
    }

    private static String firstName(String name) {
        if (name == null || name.isBlank()) return "A player";
        return name.trim().split("\\s+")[0];
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
