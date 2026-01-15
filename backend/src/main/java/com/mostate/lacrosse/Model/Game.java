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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "games")
public class Game {
    @Id
    @GeneratedValue
    private UUID id;

    private String opponent;

    @Column(name = "date")
    private Instant date;

    private String time;
    private String location;

    @Column(name = "away_logo")
    private String awayLogo;

    @Column(name = "away_link")
    private String awayLink;

    private String season;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String data;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (data == null) {
            data = "{}";
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {return id;}
    public void setId(UUID id) {this.id = id;}

    public String getOpponent() {return opponent;}
    public void setOpponent(String opponent) {this.opponent = opponent;}

    public Instant getDate() {return date;}
    public void setDate(Instant date) {this.date = date;}

    public String getTime() {return time;}
    public void setTime(String time) {this.time = time;}

    public String getLocation() {return location;}
    public void setLocation(String location) {this.location = location;}

    public String getAwayLogo() {return awayLogo;}
    public void setAwayLogo(String awayLogo) {this.awayLogo = awayLogo;}

    public String getAwayLink() {return awayLink;}
    public void setAwayLink(String awayLink) {this.awayLink = awayLink;}

    public String getSeason() {return season;}
    public void setSeason(String season) {this.season = season;}

    public String getData() {return data;}
    public void setData(String data) {this.data = data;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUpdatedAt() {return updatedAt;}
    public void setUpdatedAt(Instant updatedAt) {this.updatedAt = updatedAt;}
}
