package com.mostate.lacrosse.Controller;

import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Service.SmsService;
import com.mostate.lacrosse.Service.SmsSubscriberService;

/** Public sign-up for text updates. Works signed out; rate limited as a normal write. */
@RestController
@RequestMapping("/api/sms")
public class SmsSubscribeController {
    private final SmsSubscriberService subscribers;

    public SmsSubscribeController(SmsSubscriberService subscribers) {
        this.subscribers = subscribers;
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!Boolean.TRUE.equals(body.get("smsConsent"))) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Check the box to agree to receive texts"));
        }
        if (!Boolean.TRUE.equals(body.get("termsAccepted"))) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Accept the Terms of Service and Privacy Policy"));
        }
        String phone = SmsService.normalizePhone(body.get("phone") instanceof String p ? p : null);
        if (phone == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Enter a valid US mobile number"));
        }
        String ip = request.getHeader("X-Real-IP");
        if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();
        subscribers.subscribe(
            phone,
            body.get("name") instanceof String n ? n : null,
            body.get("source") instanceof String src ? src : "/text-updates",
            ip,
            request.getHeader("User-Agent"));
        return ResponseEntity.ok(Map.of("subscribed", true));
    }
}
