package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "recruitment_submissions")
public class RecruitmentSubmission {
    @Id
    @GeneratedValue
    private UUID id;

    private String name;
    private String email;
    private String phone;

    @Column(name = "class_year")
    private String classYear;

    private String position;
    private String hometown;

    @Column(name = "high_school")
    private String highSchool;

    private String state;
    private String instagram;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() {return id;}
    public void setId(UUID id) {this.id = id;}

    public String getName() {return name;}
    public void setName(String name) {this.name = name;}

    public String getEmail() {return email;}
    public void setEmail(String email) {this.email = email;}

    public String getPhone() {return phone;}
    public void setPhone(String phone) {this.phone = phone;}

    public String getClassYear() {return classYear;}
    public void setClassYear(String classYear) {this.classYear = classYear;}

    public String getPosition() {return position;}
    public void setPosition(String position) {this.position = position;}

    public String getHometown() {return hometown;}
    public void setHometown(String hometown) {this.hometown = hometown;}

    public String getHighSchool() {return highSchool;}
    public void setHighSchool(String highSchool) {this.highSchool = highSchool;}

    public String getState() {return state;}
    public void setState(String state) {this.state = state;}

    public String getInstagram() {return instagram;}
    public void setInstagram(String instagram) {this.instagram = instagram;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}
}
