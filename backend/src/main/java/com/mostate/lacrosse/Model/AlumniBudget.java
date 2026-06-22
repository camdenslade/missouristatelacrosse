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

@Entity
@Table(name = "alumni_budget")
public class AlumniBudget {

    @Id
    @GeneratedValue
    private UUID id;

    private String program;

    /** Season year label, e.g. "25-26" */
    private String year;

    private String category;

    private String description;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    /** "INCOME" or "EXPENSE" */
    @Column(name = "entry_type")
    private String entryType;

    @Column(name = "display_order")
    private int displayOrder;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (amount == null) amount = BigDecimal.ZERO;
        if (entryType == null) entryType = "EXPENSE";
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getProgram() { return program; }
    public void setProgram(String program) { this.program = program; }

    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getEntryType() { return entryType; }
    public void setEntryType(String entryType) { this.entryType = entryType; }

    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
