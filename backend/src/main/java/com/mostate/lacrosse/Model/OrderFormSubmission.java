package com.mostate.lacrosse.Model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A player's completed order form submission - its total is also posted as a dues CHARGE. */
@Entity
@Table(name = "order_form_submissions")
public class OrderFormSubmission {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "form_id", nullable = false)
    private UUID formId;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String selections = "[]";

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "submitted_by_uid")
    private String submittedByUid;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }

    public UUID getFormId() { return formId; }
    public void setFormId(UUID formId) { this.formId = formId; }

    public UUID getPlayerId() { return playerId; }
    public void setPlayerId(UUID playerId) { this.playerId = playerId; }

    public String getSelections() { return selections; }
    public void setSelections(String selections) { this.selections = selections; }

    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }

    public String getSubmittedByUid() { return submittedByUid; }
    public void setSubmittedByUid(String submittedByUid) { this.submittedByUid = submittedByUid; }

    public Instant getCreatedAt() { return createdAt; }
}
