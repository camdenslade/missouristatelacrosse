package com.mostate.lacrosse.Controller;

import com.mostate.lacrosse.Service.PrintifyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/printify")
public class PrintifyController{

    private final PrintifyService printifyService;

    public PrintifyController(PrintifyService printifyService){
        this.printifyService = printifyService;
    }

    @GetMapping("/products")
    public ResponseEntity<?> getProducts(){
        try{
            List<Map<String, Object>> products = printifyService.getProducts();
            return ResponseEntity.ok(products);
        } catch (Exception e){
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> orderDetails){
        try{
            Map<String, Object> result = printifyService.createOrder(orderDetails);
            return ResponseEntity.ok(result);
        } catch (Exception e){
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
