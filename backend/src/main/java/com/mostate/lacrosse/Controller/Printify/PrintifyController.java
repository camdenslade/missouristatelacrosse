package com.mostate.lacrosse.Controller.Printify;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Service.EmailService;
import com.mostate.lacrosse.Service.PrintifyService;

@RestController
@RequestMapping("/api/printify")
public class PrintifyController {

    private final PrintifyService printifyService;
    private final EmailService emailService;

    public PrintifyController(PrintifyService printifyService, EmailService emailService) {
        this.printifyService = printifyService;
        this.emailService = emailService;
    }

    @GetMapping("/products")
    public ResponseEntity<?> getProducts() {
        try {
            return ResponseEntity.ok(printifyService.getProducts());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createOrder(@RequestBody PrintifyOrderRequest req) {
        try {
            var result = printifyService.createOrder(req);
            var s = req.getShipping();
            var fullName = s.getFirstName() + " " + s.getLastName();

            var body = new StringBuilder()
                    .append("Hello ").append(fullName).append(",\n\n")
                    .append("Your payment was successfully received.\n\n")
                    .append("Order ID: ").append(req.getOrderId()).append("\n\n")
                    .append("Items:\n");

            for (var item : req.getItems()) {
                body.append("• ")
                        .append(item.getProductId())
                        .append(" × ").append(item.getQuantity())
                        .append(" (Size: ").append(item.getSize() != null ? item.getSize() : "N/A").append(")")
                        .append(" ($").append(String.format("%.2f", item.getPrice())).append(")\n");
            }

            if (req.getDonation() > 0)
                body.append("\nDonation: $").append(String.format("%.2f", req.getDonation())).append("\n");

            body.append("\nShipping to:\n")
                    .append(s.getAddress1()).append("\n")
                    .append(s.getCity()).append(", ").append(s.getRegion())
                    .append(" ").append(s.getZip()).append("\n")
                    .append(s.getCountry()).append("\n\n")
                    .append("Thank you for supporting Missouri State Lacrosse!\n\n— Missouri State Lacrosse");

            emailService.sendEmail(
                    s.getEmail(),
                    "Thank You for Your Order, " + fullName + "!",
                    body.toString()
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
