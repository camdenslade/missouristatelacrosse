package com.mostate.lacrosse.Model;

import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class CustomProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private CustomProduct product;

    @Column(nullable = false)
    private String label;  // e.g. "#12 - Large", "Small", "Red / S"

    @Column(nullable = false)
    private BigDecimal price;

    @Column(nullable = false)
    private int stock = 0;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public CustomProduct getProduct() { return product; }
    public void setProduct(CustomProduct product) { this.product = product; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public int getStock() { return stock; }
    public void setStock(int stock) { this.stock = stock; }
}
