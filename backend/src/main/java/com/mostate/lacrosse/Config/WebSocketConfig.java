package com.mostate.lacrosse.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /** Production origins plus any extras named in CORS_EXTRA_ORIGINS (used by staging). */
    @org.springframework.beans.factory.annotation.Value("${app.cors.extra-origins:}")
    private String extraOrigins = "";

    private String[] allowedOrigins() {
        java.util.List<String> origins = new java.util.ArrayList<>(java.util.List.of(
            "https://missouristatelacrosse.com",
            "https://www.missouristatelacrosse.com",
            "http://localhost:5173"
        ));
        for (String extra : extraOrigins.split(",")) {
            if (!extra.isBlank()) {
                origins.add(extra.trim());
            }
        }
        return origins.toArray(new String[0]);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins())
                .withSockJS();
    }
}
