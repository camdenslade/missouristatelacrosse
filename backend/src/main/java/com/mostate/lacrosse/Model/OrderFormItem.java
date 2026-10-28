package com.mostate.lacrosse.Model;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One pickable item on an order form - optional price, optional image, optional size/variant options. */
@Entity
@Table(name = "order_form_items")
public class OrderFormItem {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "form_id", nullable = false)
    private UUID formId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "size_category")
    private String sizeCategory;

    @Column(name = "first_year_comp", nullable = false)
    private boolean firstYearComp = false;

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    private String image;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String options = "[]";

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public UUID getId() { return id; }

    public UUID getFormId() { return formId; }
    public void setFormId(UUID formId) { this.formId = formId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSizeCategory() { return sizeCategory; }
    public void setSizeCategory(String sizeCategory) { this.sizeCategory = sizeCategory; }

    public boolean isFirstYearComp() { return firstYearComp; }
    public void setFirstYearComp(boolean firstYearComp) { this.firstYearComp = firstYearComp; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getOptions() { return options; }
    public void setOptions(String options) { this.options = options; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
