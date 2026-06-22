package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "stream_sessions")
public class StreamSession {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "key_id", nullable = false)
    private StreamKey key;

    @Column(name = "session_token", unique = true, nullable = false)
    private String sessionToken;

    @Column(name = "last_heartbeat")
    private Instant lastHeartbeat;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        lastHeartbeat = now;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public StreamKey getKey() { return key; }
    public void setKey(StreamKey key) { this.key = key; }

    public String getSessionToken() { return sessionToken; }
    public void setSessionToken(String sessionToken) { this.sessionToken = sessionToken; }

    public Instant getLastHeartbeat() { return lastHeartbeat; }
    public void setLastHeartbeat(Instant lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
