package com.mostate.lacrosse.Service;

import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import com.google.firebase.auth.FirebaseToken;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Repository.PrintifyOrderLogRepository;

@Service
public class PrintifyOrderLogService {

    private final PrintifyOrderLogRepository orderLogRepo;
    private final AuthorizationService authorizationService;

    public PrintifyOrderLogService(
        PrintifyOrderLogRepository orderLogRepo,
        AuthorizationService authorizationService
    ) {
        this.orderLogRepo = orderLogRepo;
        this.authorizationService = authorizationService;
    }

    /**
     * Verifies if a user is an admin for the given program.
     *
     * @param userId Firebase user ID
     * @param program "men" or "women"
     * @return true if user is admin for the program
     */
    public boolean isAdmin(String userId, String program, FirebaseToken token) {
        return authorizationService.isAdmin(userId, program, token);
    }

    /**
     * Fetches all order logs, sorted by timestamp descending.
     * 
     * @param limit Maximum number of logs to return
     * @return List of order logs
     */
    public List<PrintifyOrderLog> getAllOrderLogs(int limit) {
        return orderLogRepo.findAll(
            PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "timestamp"))
        ).getContent();
    }

    /**
     * Fetches the most recent order log for a specific order ID.
     *
     * @param orderId External order id (PayPal)
     * @return Optional containing the latest log if found
     */
    public java.util.Optional<PrintifyOrderLog> findLatestByOrderId(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return java.util.Optional.empty();
        }
        return orderLogRepo.findFirstByOrderIdOrderByTimestampDesc(orderId);
    }
}

