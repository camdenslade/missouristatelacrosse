package com.mostate.lacrosse.Model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account_requests")
public class AccountRequestModel {
    @Id
    @GeneratedValue
    private UUID id;

    private String email;

    @Column(name = "display_name")
    private String displayName;

    private String status;

    private String uid;

    private String program;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public AccountRequestModel() {
        this.status = "pending";
        this.program = "men";
    }

    public AccountRequestModel(String email, String displayName) {
        this.email = email;
        this.displayName = displayName;
        this.status = "pending";
        this.program = "men";
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (status == null || status.isBlank()) {
            status = "pending";
        }
        if (program == null || program.isBlank()) {
            program = "men";
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {return id;}
    public void setId(UUID id) {this.id = id;}

    public String getEmail() {return email;}
    public void setEmail(String email) {this.email = email;}

    public String getDisplayName() {return displayName;}
    public void setDisplayName(String displayName) {this.displayName = displayName;}

    public String getStatus() {return status;}
    public void setStatus(String status) {this.status = status;}

    public String getUid() {return uid;}
    public void setUid(String uid) {this.uid = uid;}

    public String getProgram() {return program;}
    public void setProgram(String program) {
        if (program == null || program.isEmpty()) {
            this.program = "men";
        } else {
            this.program = program.toLowerCase();
        }
    }

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUpdatedAt() {return updatedAt;}
    public void setUpdatedAt(Instant updatedAt) {this.updatedAt = updatedAt;}
}
