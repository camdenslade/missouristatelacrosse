package com.mostate.lacrosse.Controller;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Model.ChatMessage;
import com.mostate.lacrosse.Repository.ChatMessageRepository;
import com.mostate.lacrosse.Repository.StreamSessionRepository;
import com.mostate.lacrosse.Utils.TextSanitizer;

@Controller
public class ChatController {

    private final SimpMessagingTemplate broker;
    private final ChatMessageRepository chatRepo;
    private final StreamSessionRepository sessionRepo;

    public ChatController(
            SimpMessagingTemplate broker,
            ChatMessageRepository chatRepo,
            StreamSessionRepository sessionRepo) {
        this.broker      = broker;
        this.chatRepo    = chatRepo;
        this.sessionRepo = sessionRepo;
    }

    // Frontend sends to: /app/chat/{program}/{gameId}
    // Broadcasts to:     /topic/chat/{program}/{gameId}
    @MessageMapping("/chat/{program}/{gameId}")
    public void handleChat(
            @DestinationVariable String program,
            @DestinationVariable String gameId,
            @Payload ChatPayload payload) {

        // Set tenant context so DB queries go to the right schema
        TenantContext.setTenant(program);
        try {
            // Resolve display name: key-holder session takes precedence; free viewers supply name directly
            String displayName;
            if (payload.sessionToken() != null && !payload.sessionToken().isBlank()) {
                var sessionOpt = sessionRepo.findBySessionToken(payload.sessionToken());
                if (sessionOpt.isEmpty()) return; // silently drop invalid session
                displayName = sessionOpt.get().getKey().getDisplayName();
            } else if (payload.displayName() != null && !payload.displayName().isBlank()) {
                String cleaned = TextSanitizer.clean(payload.displayName());
                if (cleaned == null || cleaned.isBlank()) return;
                displayName = cleaned.length() > 30 ? cleaned.substring(0, 30) : cleaned;
            } else {
                return; // no identity provided
            }
            String cleanMessage = TextSanitizer.clean(payload.message());
            if (cleanMessage == null || cleanMessage.isBlank()) return;
            if (cleanMessage.length() > 300) cleanMessage = cleanMessage.substring(0, 300);

            ChatMessage msg = new ChatMessage();
            msg.setGameId(gameId);
            msg.setDisplayName(displayName);
            msg.setMessage(cleanMessage);
            chatRepo.save(msg);

            Map<String, Object> out = new HashMap<>();
            out.put("id", msg.getId().toString());
            out.put("displayName", displayName);
            out.put("message", cleanMessage);
            out.put("createdAt", Instant.now().toString());

            broker.convertAndSend("/topic/chat/" + program + "/" + gameId, out);
        } finally {
            TenantContext.clear();
        }
    }

    public record ChatPayload(String sessionToken, String displayName, String message) {}
}
