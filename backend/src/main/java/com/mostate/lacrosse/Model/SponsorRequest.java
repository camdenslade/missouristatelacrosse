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
@Table(name = "sponsor_requests")
public class SponsorRequest {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "business_name")
    private String businessName;

    @Column(name = "contact_info")
    private String contactInfo;

    private String request;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() {return id;}
    public void setId(UUID id) {this.id = id;}

    public String getBusinessName() {return businessName;}
    public void setBusinessName(String businessName) {this.businessName = businessName;}

    public String getContactInfo() {return contactInfo;}
    public void setContactInfo(String contactInfo) {this.contactInfo = contactInfo;}

    public String getRequest() {return request;}
    public void setRequest(String request) {this.request = request;}

    public Instant getCreatedAt() {return createdAt;}
    public void setCreatedAt(Instant createdAt) {this.createdAt = createdAt;}
}
