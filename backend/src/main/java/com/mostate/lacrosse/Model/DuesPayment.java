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

@Entity
@Table(name = "dues_payments")
public class DuesPayment {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    /** PAYMENT, CHARGE, CREDIT, ADJUSTMENT */
    @Column(nullable = false)
    private String type;

    private String note;

    @Column(name = "paid_by_uid")
    private String paidByUid;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }

    public UUID getPlayerId() { return playerId; }
    public void setPlayerId(UUID playerId) { this.playerId = playerId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getPaidByUid() { return paidByUid; }
    public void setPaidByUid(String paidByUid) { this.paidByUid = paidByUid; }

    public Instant getCreatedAt() { return createdAt; }
}
