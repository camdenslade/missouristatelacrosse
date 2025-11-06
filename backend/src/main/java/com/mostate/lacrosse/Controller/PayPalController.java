package com.mostate.lacrosse.Controller;

import com.mostate.lacrosse.Service.PayPalSDKService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/paypal")
public class PayPalController {
    private final PayPalSDKService payPalSDKService;

    public PayPalController(PayPalSDKService payPalSDKService){
        this.payPalSDKService = payPalSDKService;
    }

    @PostMapping("/create")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> body){
        String amount = (String) body.get("amount");
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

    @GetMapping("/capture")
    public ResponseEntity<?> captureOrder(@RequestParam String orderID){
        try{
            return ResponseEntity.ok(payPalSDKService.captureOrder(orderID));
        } catch (Exception e){
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }
}
