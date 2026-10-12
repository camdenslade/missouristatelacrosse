package com.mostate.lacrosse.Utils;

/**
 * One shared look for every outbound email - a maroon header with the program name, a
 * white card for the message body, and a plain footer. Existing call sites each built this
 * same structure inline by hand (see PlayerOnboardingService for the original); new email
 * sends should use this instead of writing their own HTML, so the organization's email
 * looks consistent no matter which feature sent it. Migrating the existing inline senders
 * to this helper is a follow-up, not done as part of adding this class.
 */
public final class EmailTemplate {
    private EmailTemplate() {}

    /**
     * @param programLabel "Men's" / "Women's" / "" - goes in the header title.
     * @param bodyHtml     inner HTML for the white card - plain tags only (p, a, hr, etc),
     *                     no need to repeat fonts/colors, those are set by the wrapper.
     */
    public static String wrap(String programLabel, String bodyHtml) {
        String title = programLabel == null || programLabel.isBlank()
            ? "MISSOURI STATE LACROSSE"
            : "MISSOURI STATE " + programLabel.toUpperCase() + " LACROSSE";
        String footerProgram = programLabel == null || programLabel.isBlank() ? "" : " " + programLabel;

        return String.format("""
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
                <tr>
                  <td align="center">
                    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                      <tr>
                        <td style="background:#5E0009;padding:28px 40px;text-align:center;">
                          <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">%s</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:36px 40px;">
                          %s
                          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
                          <p style="font-size:13px;color:#999;margin:0;">Go Bears! Missouri State%s Lacrosse</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """, title, bodyHtml, footerProgram);
    }

    /** A maroon call-to-action button, for use inside bodyHtml. */
    public static String button(String href, String label) {
        return String.format(
            "<div style=\"text-align:center;margin:0 0 24px;\">" +
            "<a href=\"%s\" style=\"background:#5E0009;color:#fff;text-decoration:none;padding:14px 32px;" +
            "border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;\">%s</a></div>",
            href, label
        );
    }

    /** A body paragraph, for use inside bodyHtml. */
    public static String paragraph(String text) {
        return "<p style=\"font-size:15px;color:#555;margin:0 0 16px;line-height:1.5;\">" + text + "</p>";
    }
}
