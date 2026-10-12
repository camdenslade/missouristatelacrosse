package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** VP's compliance tracker: Missouri annual filings, IRS yearly filings, and grant renewals. */
@Entity
@Table(name = "compliance_filings")
public class ComplianceFiling {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String type; // MO_ANNUAL, IRS, GRANT

    @Column(nullable = false)
    private String name;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "last_filed")
    private LocalDate lastFiled;

    @Column(nullable = false)
    private String status; // pending, filed, overdue

    private String notes;

    private String link;

    @Column(nullable = false)
    private boolean recurring = false;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (status == null) status = "pending";
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public LocalDate getLastFiled() { return lastFiled; }
    public void setLastFiled(LocalDate lastFiled) { this.lastFiled = lastFiled; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getLink() { return link; }
    public void setLink(String link) { this.link = link; }

    public boolean isRecurring() { return recurring; }
    public void setRecurring(boolean recurring) { this.recurring = recurring; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
