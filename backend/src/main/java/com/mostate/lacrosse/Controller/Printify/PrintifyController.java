package com.mostate.lacrosse.Controller.Printify;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PaymentReceiptService;
import com.mostate.lacrosse.Service.PrintifyOrderLogService;
import com.mostate.lacrosse.Service.PrintifyService;
import com.mostate.lacrosse.Utils.JsonUtils;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/printify")
public class PrintifyController {

    private final PrintifyService printifyService;
    private final EmailService emailService;
    private final PrintifyOrderLogService orderLogService;
    private final PaymentReceiptService paymentReceiptService;

    public PrintifyController(
        PrintifyService printifyService,
        EmailService emailService,
        PrintifyOrderLogService orderLogService,
        PaymentReceiptService paymentReceiptService
    ) {
        this.printifyService = printifyService;
        this.emailService = emailService;
        this.orderLogService = orderLogService;
        this.paymentReceiptService = paymentReceiptService;
    }

    @GetMapping("/products")
    public ResponseEntity<?> getProducts() {
        try {
            return ResponseEntity.ok(printifyService.getProducts());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Customer-friendly order lookup used on checkout success page.
     * Returns only sanitized line items and shipping details for a single order.
     */
    @GetMapping("/orders/{orderId}")
    public ResponseEntity<?> getOrderForCustomer(@PathVariable String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Order ID is required"));
        }

        try {
            PrintifyOrderLog log = orderLogService.findLatestByOrderId(orderId).orElse(null);
            if (log == null || log.getRequestPayload() == null || log.getRequestPayload().isBlank()) {
                return ResponseEntity.status(404).body(new ErrorResponse("Order not found"));
            }

            Map<String, Object> payload = JsonUtils.readMap(log.getRequestPayload());
            if (payload.isEmpty()) {
                return ResponseEntity.status(404).body(new ErrorResponse("Order not found"));
            }

            Map<String, Object> addr = asMap(payload.get("address_to"));
            ShippingDetails shipping = new ShippingDetails(
                readString(addr.get("first_name")),
                readString(addr.get("last_name")),
                readString(addr.get("email")),
                readString(addr.get("phone")),
                readString(addr.get("address1")),
                readString(addr.get("address2")),
                readString(addr.get("city")),
                readString(addr.get("region")),
                readString(addr.get("zip")),
                readString(addr.get("country"))
            );

            List<OrderItem> items = new ArrayList<>();
            for (Object obj : asList(payload.get("line_items"))) {
                Map<String, Object> map = asMap(obj);
                String productId = readString(map.get("product_id"));
                String variantId = readString(map.get("variant_id"));
                Integer qty = readInt(map.get("quantity"));
                if (productId != null && variantId != null) {
                    items.add(new OrderItem(productId, variantId, qty != null && qty > 0 ? qty : 1));
                }
            }

            if (items.isEmpty()) {
                return ResponseEntity.status(404).body(new ErrorResponse("Order items not found"));
            }

            return ResponseEntity.ok(new PublicOrderResponse(orderId, items, shipping));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Failed to load order: " + e.getMessage()));
        }
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createOrder(@Valid @RequestBody PrintifyOrderRequest req) {
        try {
            var result = printifyService.createOrder(req);
            var s = req.getShipping();
            var fullName = resolveCustomerName(req.getOrderId(), s.getFirstName(), s.getLastName());

            var body = new StringBuilder()
                .append("Hello ").append(fullName).append(",\n\n")
                .append("Your payment was successfully received.\n\n")
                .append("Order ID: ").append(req.getOrderId()).append("\n\n")
                .append("Items:\n");

            for (var item : req.getItems()) {
                body.append("- ")
                    .append(item.getProductId())
                    .append(" × ").append(item.getQuantity())
                    .append(" (Size: ").append(item.getSize() != null ? item.getSize() : "N/A").append(")")
                    .append(" ($").append(String.format("%.2f", item.getPrice())).append(")\n");
            }

            if (req.getDonation() > 0) {
                body.append("\nDonation: $").append(String.format("%.2f", req.getDonation())).append("\n");
            }

            body.append("\nShipping to:\n")
                .append(s.getAddress1()).append("\n")
                .append(s.getCity()).append(", ").append(s.getRegion())
                .append(" ").append(s.getZip()).append("\n")
                .append(s.getCountry()).append("\n\n")
                .append("Thank you for supporting Missouri State Lacrosse!\n\n- Missouri State Lacrosse");

            emailService.sendEmail(
                s.getEmail(),
                "Thank You for Your Order, " + fullName + "!",
                body.toString()
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Prefer the payer name captured from PayPal; fall back to shipping name.
     */
    private String resolveCustomerName(String orderId, String shipFirst, String shipLast) {
        try {
            var receipt = paymentReceiptService.findReceipt(orderId).orElse(null);
            String payer = receipt != null ? trimToNull(receipt.getPayerName()) : null;
            if (payer != null) return payer;
        } catch (Exception ignored) {}

        String first = trimToNull(shipFirst);
        String last = trimToNull(shipLast);
        if (first == null && last == null) return "there";
        if (first == null) return last;
        if (last == null) return first;
        return (first + " " + last).trim();
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> casted = (Map<String, Object>) map;
            return casted;
        }
        return Collections.emptyMap();
    }

    private static List<Object> asList(Object value) {
        if (value instanceof List<?> list) {
            @SuppressWarnings("unchecked")
            List<Object> casted = (List<Object>) list;
            return casted;
        }
        return Collections.emptyList();
    }

    private static String readString(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Integer readInt(Object value) {
        if (value == null) return null;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public record OrderItem(String productId, String variantId, int quantity) {}

    public record ShippingDetails(
        String first_name,
        String last_name,
        String email,
        String phone,
        String address1,
        String address2,
        String city,
        String region,
        String zip,
        String country
    ) {}

    public record PublicOrderResponse(String orderId, List<OrderItem> items, ShippingDetails shipping) {}
}
