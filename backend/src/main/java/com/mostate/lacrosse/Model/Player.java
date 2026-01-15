package com.mostate.lacrosse.Model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonProperty;
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
@Table(name = "players")
public class Player {
    @Id
    @GeneratedValue
    private UUID id;

    private String name;
    private String email;
    private String season;
    private String number;
    private String position;

    @Column(name = "class_year")
    private String classYear;

    @JsonProperty("photo")
    @Column(name = "photo_url")
    private String photoUrl;

    @Column(precision = 10, scale = 2)
    private BigDecimal balance;

    @Column(name = "profile_id")
    private UUID profileId;

    @Column(name = "user_uid")
    private String userUid;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String parents;

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
        if (balance == null) {
            balance = BigDecimal.ZERO;
        }
        if (parents == null) {
            parents = "[]";
        }
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

    public String getName() {return name;}
    public void setName(String name) {this.name = name;}

    public String getEmail() {return email;}
    public void setEmail(String email) {this.email = email;}

    public String getSeason() {return season;}
    public void setSeason(String season) {this.season = season;}

    public String getNumber() {return number;}
    public void setNumber(String number) {this.number = number;}

    public String getPosition() {return position;}
    public void setPosition(String position) {this.position = position;}

    public String getClassYear() {return classYear;}
    public void setClassYear(String classYear) {this.classYear = classYear;}

    public String getPhotoUrl() {return photoUrl;}
    public void setPhotoUrl(String photoUrl) {this.photoUrl = photoUrl;}

    public BigDecimal getBalance() {return balance;}
    public void setBalance(BigDecimal balance) {this.balance = balance;}

    public UUID getProfileId() {return profileId;}
    public void setProfileId(UUID profileId) {this.profileId = profileId;}

    public String getUserUid() {return userUid;}
    public void setUserUid(String userUid) {this.userUid = userUid;}

    public String getParents() {return parents;}
    public void setParents(String parents) {this.parents = parents;}

    public String getData() {return data;}
    public void setData(String data) {this.data = data;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}

    public Instant getUpdatedAt() {return updatedAt;}
    public void setUpdatedAt(Instant updatedAt) {this.updatedAt = updatedAt;}
}
