package com.mostate.lacrosse.Model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "fundraisers")
public class Fundraiser {
    @Id
    @GeneratedValue
    private UUID id;

    private String title;
    private String slug;
    private String description;
    private String image;

    // Optional external link override for the homepage banner's "Donate Now" button.
    // When blank, the banner links to this campaign's own page instead.
    private String link;

    @Column(name = "goal_amount")
    private BigDecimal goalAmount;

    private String program;

    // Line-item expense breakdown, e.g. [{ "label": "...", "amount": 100, "detail": "..." }]
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String expenses = "[]";

    // "Currently featured in the homepage banner" - at most one fundraiser is active at a time.
    private boolean active;

    // "This campaign's page is publicly reachable" - independent of active.
    private boolean published = true;

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

    public String getTitle() {return title;}
    public void setTitle(String title) {this.title = title;}

    public String getSlug() {return slug;}
    public void setSlug(String slug) {this.slug = slug;}

    public String getDescription() {return description;}
    public void setDescription(String description) {this.description = description;}

    public String getImage() {return image;}
    public void setImage(String image) {this.image = image;}

    public String getLink() {return link;}
    public void setLink(String link) {this.link = link;}

    public BigDecimal getGoalAmount() {return goalAmount;}
    public void setGoalAmount(BigDecimal goalAmount) {this.goalAmount = goalAmount;}

    public String getProgram() {return program;}
    public void setProgram(String program) {this.program = program;}

    public String getExpenses() {return expenses;}
    public void setExpenses(String expenses) {this.expenses = expenses;}

    public boolean isActive() {return active;}
    public void setActive(boolean active) {this.active = active;}

    public boolean isPublished() {return published;}
    public void setPublished(boolean published) {this.published = published;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUpdatedAt() {return updatedAt;}
    public void setUpdatedAt(Instant updatedAt) {this.updatedAt = updatedAt;}
}
