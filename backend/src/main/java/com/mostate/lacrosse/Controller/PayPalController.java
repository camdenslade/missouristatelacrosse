package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
            return ResponseEntity.ok(payPalSDKService.createOrder(formatted));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid amount"));
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/capture")
    public ResponseEntity<?> captureOrder(
        @RequestParam String orderID,
        @RequestParam(required = false) String source
    ){
        try{
            var cached = receiptService.findStoredPayload(orderID);
            if (cached.isPresent()) {
                return ResponseEntity.ok(cached.get());
            }

            var payload = payPalSDKService.captureOrder(orderID);
            receiptService.recordPayPalReceipt(payload, source);
            return ResponseEntity.ok(payload);
        } catch (Exception e){
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
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

    public record CreateOrderRequest(@NotBlank String amount, Boolean includeShippingFee) {}
}
