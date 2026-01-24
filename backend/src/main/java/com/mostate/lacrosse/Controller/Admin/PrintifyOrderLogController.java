package com.mostate.lacrosse.Controller.Admin;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Service.PrintifyOrderLogService;
import com.mostate.lacrosse.Service.PaymentReceiptService;

@RestController
@RequestMapping("/api/admin/printify")
public class PrintifyOrderLogController {

    private final PrintifyOrderLogService orderLogService;
    private final PaymentReceiptService paymentReceiptService;

    public PrintifyOrderLogController(
        PrintifyOrderLogService orderLogService,
        PaymentReceiptService paymentReceiptService
    ) {
        this.orderLogService = orderLogService;
        this.paymentReceiptService = paymentReceiptService;
    }

    /**
     * Admin-only endpoint to fetch all Printify order logs.
     * Requires admin role for either men's or women's program.
     * 
     * @param userId Firebase user ID (from Authorization header or query param)
     * @param program Program context ("men" or "women")
     * @param limit Maximum number of logs to return (default 100)
     * @return List of order logs
     */
    @GetMapping("/orders")
    public ResponseEntity<?> getOrderLogs(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestParam(value = "userId", required = false) String userIdParam,
            @RequestParam(value = "program", defaultValue = "men") String program,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        
        // Get userId from header or param
        String effectiveUserId = userId != null ? userId : userIdParam;
        
        if (effectiveUserId == null || effectiveUserId.isEmpty()) {
            return ResponseEntity.status(401).body(new ErrorResponse("User ID is required"));
        }

        // Enforce admin-only access
        if (!orderLogService.isAdmin(effectiveUserId, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        try {
            // Cap limit to prevent abuse
            int safeLimit = Math.min(Math.max(limit, 1), 500);
            
            List<PrintifyOrderLog> logs = orderLogService.getAllOrderLogs(safeLimit);
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Failed to fetch order logs: " + e.getMessage()));
        }
    }

    /**
     * Admin-only lookup by PayPal/Printify order id.
     * Returns both the Printify order log (if any) and stored PayPal receipt (if captured).
     */
    @GetMapping("/orders/lookup")
    public ResponseEntity<?> lookupOrder(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @RequestParam(value = "userId", required = false) String userIdParam,
        @RequestParam(value = "program", defaultValue = "men") String program,
        @RequestParam(value = "orderId") String orderId
    ) {
        String effectiveUserId = userId != null ? userId : userIdParam;
        if (effectiveUserId == null || effectiveUserId.isEmpty()) {
            return ResponseEntity.status(401).body(new ErrorResponse("User ID is required"));
        }
        if (!orderLogService.isAdmin(effectiveUserId, program)) {
            return ResponseEntity.status(403).body(new ErrorResponse("Admin access required"));
        }

        if (orderId == null || orderId.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("orderId is required"));
        }

        try {
            PrintifyOrderLog log = orderLogService.findLatestByOrderId(orderId).orElse(null);
            PaymentReceipt receipt = paymentReceiptService.findReceipt(orderId).orElse(null);

            if (log == null && receipt == null) {
                return ResponseEntity.status(404).body(new ErrorResponse("Order not found"));
            }

            return ResponseEntity.ok(new OrderLookupResponse(orderId, log, receipt));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Failed to lookup order: " + e.getMessage()));
        }
    }

    public record OrderLookupResponse(
        String orderId,
        PrintifyOrderLog printifyLog,
        PaymentReceipt paymentReceipt
    ) {}
}

