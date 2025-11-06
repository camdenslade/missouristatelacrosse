package com.mostate.lacrosse.Controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Service.PayPalSDKService;

@RestController
@RequestMapping("/api/paypal")
public class PayPalController {
    private final PayPalSDKService payPalSDKService;
    @Value("${paypal.client.id}")
    private String clientId;

    public PayPalController(PayPalSDKService payPalSDKService){
        this.payPalSDKService = payPalSDKService;
    }

    @PostMapping("/create")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> body){
        Object amountObj = body.get("amount");
        String amount = amountObj != null ? String.valueOf(amountObj) : null;
        if (amount == null || amount.isBlank()){
            return ResponseEntity.badRequest().body(Map.of("error", "Amount is required"));
        }

        try{
            return ResponseEntity.ok(payPalSDKService.createOrder(amount));
        } catch (Exception e){
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/capture")
    public ResponseEntity<?> captureOrder(@RequestParam String orderID){
        try{
            return ResponseEntity.ok(payPalSDKService.captureOrder(orderID));
        } catch (Exception e){
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/client-id")
    public ResponseEntity<?> getClientId(){
        return ResponseEntity.ok(Map.of("clientId", clientId));
    }
}
