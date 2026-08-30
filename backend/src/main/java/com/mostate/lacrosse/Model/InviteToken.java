package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "invite_tokens")
public class InviteToken {
    @Id
    private UUID token;

    @Column(name = "firebase_uid", nullable = false)
    private String firebaseUid;

    private String email;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @PrePersist
    void onCreate() {
        if (token == null) {
            token = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getToken() {return token;}
    public void setToken(UUID token) {this.token = token;}

    public String getFirebaseUid() {return firebaseUid;}
    public void setFirebaseUid(String firebaseUid) {this.firebaseUid = firebaseUid;}

    public String getEmail() {return email;}
    public void setEmail(String email) {this.email = email;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUsedAt() {return usedAt;}
    public void setUsedAt(Instant usedAt) {this.usedAt = usedAt;}
}
