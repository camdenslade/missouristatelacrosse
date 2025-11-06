package com.mostate.lacrosse.Controller.Printify;

import java.util.List;

public class PrintifyOrderRequest {
    private String orderId;
    private List<PrintifyOrderItem> items;
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
}
