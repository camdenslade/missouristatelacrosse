package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "stream_keys")
public class StreamKey {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "game_id", nullable = false)
    private String gameId;

    @Column(name = "key_code", unique = true, nullable = false)
    private String keyCode;

    @Column(nullable = false)
    private String tier; // ONE_SCREEN | TWO_SCREEN

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(nullable = false)
    private String email;

    @Column(name = "paypal_order_id")
    private String paypalOrderId;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }

    public String getKeyCode() { return keyCode; }
    public void setKeyCode(String keyCode) { this.keyCode = keyCode; }

    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPaypalOrderId() { return paypalOrderId; }
    public void setPaypalOrderId(String paypalOrderId) { this.paypalOrderId = paypalOrderId; }

    public Instant getActivatedAt() { return activatedAt; }
    public void setActivatedAt(Instant activatedAt) { this.activatedAt = activatedAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
