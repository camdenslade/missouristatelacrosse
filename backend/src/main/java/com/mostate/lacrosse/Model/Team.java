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
@Table(name = "teams")
public class Team {
    @Id
    @GeneratedValue
    private UUID id;

    private String name;

    @Column(name = "name_lower")
    private String nameLower;

    @Column(name = "logo_url")
    private String logoUrl;

    private String link;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (nameLower == null && name != null) {
            nameLower = name.toLowerCase();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        if (nameLower == null && name != null) {
            nameLower = name.toLowerCase();
        }
    }

    public UUID getId() {return id;}
    public void setId(UUID id) {this.id = id;}

    public String getName() {return name;}
    public void setName(String name) {this.name = name;}

    public String getNameLower() {return nameLower;}
    public void setNameLower(String nameLower) {this.nameLower = nameLower;}

    public String getLogoUrl() {return logoUrl;}
    public void setLogoUrl(String logoUrl) {this.logoUrl = logoUrl;}

    public String getLink() {return link;}
    public void setLink(String link) {this.link = link;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUpdatedAt() {return updatedAt;}
    public void setUpdatedAt(Instant updatedAt) {this.updatedAt = updatedAt;}
}
