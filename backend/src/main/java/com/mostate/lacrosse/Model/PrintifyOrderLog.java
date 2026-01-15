package com.mostate.lacrosse.Model;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "printify_order_logs")
public class PrintifyOrderLog {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "order_id")
    private String orderId; // external_id

    @Column(name = "shop_id")
    private String shopId;

    @Column(name = "timestamp_ms")
    private long timestamp;

    @Column(name = "request_payload")
    private String requestPayload; // JSON string

    @Column(name = "response_payload")
    private String responsePayload; // JSON string or error body

    @Column(name = "http_status_code")
    private Integer httpStatusCode;

    private boolean success;

    @Column(name = "error_message")
    private String errorMessage;

    public PrintifyOrderLog() {
        this.timestamp = System.currentTimeMillis();
        this.success = false;
    }

    public PrintifyOrderLog(String orderId, String shopId) {
        this();
        this.orderId = orderId;
        this.shopId = shopId;
    }

    @PrePersist
    void onCreate() {
        if (timestamp == 0) {
            timestamp = System.currentTimeMillis();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getShopId() {
        return shopId;
    }

    public void setShopId(String shopId) {
        this.shopId = shopId;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public String getRequestPayload() {
        return requestPayload;
    }

    public void setRequestPayload(String requestPayload) {
        this.requestPayload = requestPayload;
    }

    public String getResponsePayload() {
        return responsePayload;
    }

    public void setResponsePayload(String responsePayload) {
        this.responsePayload = responsePayload;
    }

    public Integer getHttpStatusCode() {
        return httpStatusCode;
    }

    public void setHttpStatusCode(Integer httpStatusCode) {
        this.httpStatusCode = httpStatusCode;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public LocalDateTime getTimestampAsDateTime() {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneId.systemDefault());
    }
}

