package com.mostate.lacrosse.Controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Service.FundraiserOutreachService;

/** Unsubscribe link from outreach emails. Lives outside /api/fundraisers so it works signed out. */
@RestController
@RequestMapping("/api/unsubscribe")
public class UnsubscribeController {
    private final FundraiserOutreachService outreach;

    public UnsubscribeController(FundraiserOutreachService outreach) {
        this.outreach = outreach;
    }

    @PostMapping
    public ResponseEntity<?> unsubscribe(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        if (token == null || token.isBlank() || !outreach.unsubscribe(token.trim())) {
            return ResponseEntity.badRequest().body(new ErrorResponse("That unsubscribe link isn't valid"));
        }
        return ResponseEntity.ok(Map.of("unsubscribed", true));
    }
}
