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
@Table(name = "raffles")
public class Raffle {

    @Id
    @GeneratedValue
    private UUID id;

    private String name;
    private String slug;
    private String description;
    private String image;

    @Column(name = "ticket_price")
    private BigDecimal ticketPrice;

    @Column(name = "max_tickets_per_person")
    private Integer maxTicketsPerPerson;

    @Column(name = "allow_bids")
    private boolean allowBids = false;

    private boolean published = false;

    // "active", "closed", "drawn"
    private String status = "active";

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "winner_name")
    private String winnerName;

    @Column(name = "winner_email")
    private String winnerEmail;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "stream_data", columnDefinition = "jsonb")
    private String streamData;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "images", columnDefinition = "jsonb")
    private String images;

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

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public BigDecimal getTicketPrice() { return ticketPrice; }
    public void setTicketPrice(BigDecimal ticketPrice) { this.ticketPrice = ticketPrice; }

    public Integer getMaxTicketsPerPerson() { return maxTicketsPerPerson; }
    public void setMaxTicketsPerPerson(Integer maxTicketsPerPerson) { this.maxTicketsPerPerson = maxTicketsPerPerson; }

    public boolean isAllowBids() { return allowBids; }
    public void setAllowBids(boolean allowBids) { this.allowBids = allowBids; }

    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }

    public String getWinnerName() { return winnerName; }
    public void setWinnerName(String winnerName) { this.winnerName = winnerName; }

    public String getWinnerEmail() { return winnerEmail; }
    public void setWinnerEmail(String winnerEmail) { this.winnerEmail = winnerEmail; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getStreamData() { return streamData; }
    public void setStreamData(String streamData) { this.streamData = streamData; }

    public String getImages() { return images; }
    public void setImages(String images) { this.images = images; }
}
