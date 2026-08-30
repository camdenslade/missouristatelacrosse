package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;
import com.mostate.lacrosse.Dto.ClientIdResponse;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Service.PayPalSDKService;
import com.mostate.lacrosse.Service.PaymentReceiptService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@RestController
@RequestMapping("/api/paypal")
@Validated
public class PayPalController {
    private final PayPalSDKService payPalSDKService;
    private final PaymentReceiptService receiptService;
    private static final BigDecimal SHIPPING_FEE = BigDecimal.valueOf(5);
    @Value("${paypal.client.id}")
    private String clientId;

    public PayPalController(
        PayPalSDKService payPalSDKService,
        PaymentReceiptService receiptService
    ){
        this.payPalSDKService = payPalSDKService;
        this.receiptService = receiptService;
    }

    @PostMapping("/create")
    public ResponseEntity<?> createOrder(@Valid @RequestBody CreateOrderRequest body){
        try{
            BigDecimal amount = new BigDecimal(body.amount());

            if (Boolean.TRUE.equals(body.includeShippingFee())) {
                amount = amount.add(SHIPPING_FEE);
            }

            String formatted = amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
            Map<String, Object> order = payPalSDKService.createOrder(formatted);
            // Bind the intended source to this order id now, at creation time — capture
            // can no longer be spoofed into claiming an unrelated payment (e.g. a donation)
            // was actually for dues, since the source is fixed before the buyer ever pays.
            if (body.source() != null && !body.source().isBlank() && order != null) {
                Object orderId = order.get("id");
                if (orderId != null) {
                    receiptService.reserveSource(String.valueOf(orderId), body.source());
                }
            }
            return ResponseEntity.ok(order);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/capture")
    public ResponseEntity<?> captureOrder(@RequestParam String orderID){
        try{
            var cached = receiptService.findStoredPayload(orderID);
            if (cached.isPresent()) {
                return ResponseEntity.ok(cached.get());
            }

            var payload = payPalSDKService.captureOrder(orderID);
            // Source is never taken from the request here — it was fixed at /create time
            // via reserveSource(), so recordPayPalReceipt() leaves it untouched.
            receiptService.recordPayPalReceipt(payload, null);
            return ResponseEntity.ok(payload);
        } catch (Exception e){
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    // Read-only lookup of an already-captured order's stored payload — for re-displaying
    // a completed checkout (page refresh, back button, shared link) without re-invoking
    // capture at all, even though /capture is itself idempotent via the same cache.
    @GetMapping("/receipt")
    public ResponseEntity<?> getReceipt(@RequestParam String orderID){
        return receiptService.findStoredPayload(orderID)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/total")
    public ResponseEntity<?> getTotal(@RequestParam String source){
        try {
            var total = receiptService.sumBySource(source);
            return ResponseEntity.ok(java.util.Map.of("total", total));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/client-id")
    public ResponseEntity<?> getClientId(){
        return ResponseEntity.ok(new ClientIdResponse(clientId));
    }

    public record CreateOrderRequest(@NotBlank String amount, Boolean includeShippingFee, String source) {}
}
