package com.mostate.lacrosse.Controller;

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
            return ResponseEntity.ok(payPalSDKService.createOrder(body.amount()));
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
            receiptService.recordPayPalReceipt(payload);
            return ResponseEntity.ok(payload);
        } catch (Exception e){
            return ResponseEntity.internalServerError().body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/client-id")
    public ResponseEntity<?> getClientId(){
        return ResponseEntity.ok(new ClientIdResponse(clientId));
    }

    public record CreateOrderRequest(@NotBlank String amount) {}
}
