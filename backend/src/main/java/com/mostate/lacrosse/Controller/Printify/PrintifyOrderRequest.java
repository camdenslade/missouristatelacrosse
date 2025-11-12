package com.mostate.lacrosse.Controller.Printify;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public class PrintifyOrderRequest {
    @NotBlank(message = "Order ID is required")
    private String orderId;

    @NotEmpty(message = "At least one item is required")
    @Valid
    private List<PrintifyOrderItem> items;

    @NotNull(message = "Shipping information is required")
    @Valid
    private ShippingInfo shipping;

    private double donation;

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public List<PrintifyOrderItem> getItems() { return items; }
    public void setItems(List<PrintifyOrderItem> items) { this.items = items; }

    public ShippingInfo getShipping() { return shipping; }
    public void setShipping(ShippingInfo shipping) { this.shipping = shipping; }

    public double getDonation() { return donation; }
    public void setDonation(double donation) { this.donation = donation; }

    public static class PrintifyOrderItem {
        @NotBlank(message = "Product ID is required")
        private String productId;

        @NotBlank(message = "Variant ID is required")
        private String variantId;

        private int quantity;

        @NotBlank(message = "Size is required")
        private String size;

        private double price;

        public String getProductId() { return productId; }
        public void setProductId(String productId) { this.productId = productId; }

        public String getVariantId() { return variantId; }
        public void setVariantId(String variantId) { this.variantId = variantId; }

        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }

        public String getSize() { return size; }
        public void setSize(String size) { this.size = size; }

        public double getPrice() { return price; }
        public void setPrice(double price) { this.price = price; }
    }
}
