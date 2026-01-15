package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "player_profiles")
public class PlayerProfile {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "firebase_uid")
    private String firebaseUid;

    private String name;
    private String email;

    @Column(name = "merge_key")
    private String mergeKey;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {return id;}
    public void setId(UUID id) {this.id = id;}

    public String getFirebaseUid() {return firebaseUid;}
    public void setFirebaseUid(String firebaseUid) {this.firebaseUid = firebaseUid;}

    public String getName() {return name;}
    public void setName(String name) {this.name = name;}

    public String getEmail() {return email;}
    public void setEmail(String email) {this.email = email;}

    public String getMergeKey() {return mergeKey;}
    public void setMergeKey(String mergeKey) {this.mergeKey = mergeKey;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUpdatedAt() {return updatedAt;}
    public void setUpdatedAt(Instant updatedAt) {this.updatedAt = updatedAt;}
}
