package com.mostate.lacrosse.Service;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import com.mostate.lacrosse.Config.TenantContext;

/**
 * Self-serve text message sign-ups from /text-updates. This is the only way a number gets on
 * the list, matching the 10DLC campaign: the person enters their own number and checks an
 * unchecked consent box. STOP replies are handled by AWS's opt-out list.
 */
@Service
public class SmsSubscriberService {
    /** Shown next to the checkbox on /text-updates. Keep the two in sync. */
    public static final String CONSENT_TEXT =
        "By checking this box, you agree to receive recurring text messages from Missouri State Men's Lacrosse "
            + "with team updates, event reminders, and fundraiser news. Consent is not a condition of any purchase "
            + "or donation. Message frequency varies. Message and data rates may apply. Reply HELP for help or "
            + "STOP to opt out at any time.";

    public static final String CONFIRMATION_TEXT =
        "Missouri State Lacrosse: You're signed up for team updates, event reminders, and fundraiser news. "
            + "Msg frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to cancel.";

    private final JdbcTemplate jdbc;
    private final SmsService smsService;

    public SmsSubscriberService(JdbcTemplate jdbc, SmsService smsService) {
        this.jdbc = jdbc;
        this.smsService = smsService;
    }

    private static String schema() {
        return "women".equals(TenantContext.getTenant()) ? "women" : "men";
    }

    private static String clip(String value, int max) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isEmpty()) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }

    /** Records the opt-in (or renews it) and sends the confirmation text once texting is live. */
    public void subscribe(String phone, String name, String source, String ip, String userAgent) {
        String s = schema();
        jdbc.update(
            "INSERT INTO " + s + ".sms_subscribers (phone, name, consent_text, source, ip, user_agent) "
                + "VALUES (?, ?, ?, ?, ?, ?) "
                + "ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, " + s + ".sms_subscribers.name), "
                + "consent_text = EXCLUDED.consent_text, source = EXCLUDED.source, ip = EXCLUDED.ip, "
                + "user_agent = EXCLUDED.user_agent, opted_in_at = now(), opted_out_at = NULL",
            phone, clip(name, 80), CONSENT_TEXT, clip(source, 200), clip(ip, 64), clip(userAgent, 300));

        if (!smsService.isEnabled()) return;
        SmsService.Result result = smsService.send(phone, CONFIRMATION_TEXT);
        if (result == SmsService.Result.SENT) {
            jdbc.update("UPDATE " + s + ".sms_subscribers SET confirmed_at = now() WHERE phone = ?", phone);
        } else if (result == SmsService.Result.OPTED_OUT) {
            // They texted STOP before; AWS blocks sends until they reply START/JOIN themselves.
            jdbc.update("UPDATE " + s + ".sms_subscribers SET opted_out_at = now() WHERE phone = ?", phone);
        }
    }

    public Map<String, Object> counts() {
        return jdbc.queryForMap(
            "SELECT count(*) FILTER (WHERE opted_out_at IS NULL) AS active, count(*) AS total FROM "
                + schema() + ".sms_subscribers");
    }
}
