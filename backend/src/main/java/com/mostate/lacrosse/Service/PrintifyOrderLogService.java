package com.mostate.lacrosse.Service;

import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mostate.lacrosse.Model.PrintifyOrderLog;
import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.PrintifyOrderLogRepository;
import com.mostate.lacrosse.Repository.UserAccountRepository;

@Service
public class PrintifyOrderLogService {
    
    private final PrintifyOrderLogRepository orderLogRepo;
    private final UserAccountRepository userRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public PrintifyOrderLogService(
        PrintifyOrderLogRepository orderLogRepo,
        UserAccountRepository userRepository
    ) {
        this.orderLogRepo = orderLogRepo;
        this.userRepository = userRepository;
    }

    /**
     * Verifies if a user is an admin for the given program.
     * 
     * @param userId Firebase user ID
     * @param program "men" or "women"
     * @return true if user is admin for the program
     */
    public boolean isAdmin(String userId, String program) {
        if (userId == null || userId.isEmpty() || program == null || program.isEmpty()) {
            return false;
        }

        try {
            UserAccount user = userRepository.findByFirebaseUid(userId).orElse(null);
            if (user == null || user.getRoles() == null) {
                return false;
            }
            Map<String, Object> roles = mapper.readValue(
                user.getRoles(),
                new TypeReference<Map<String, Object>>() {}
            );
            Object role = roles.get(program.toLowerCase());
            return role != null && "admin".equalsIgnoreCase(String.valueOf(role));
        } catch (Exception e) {
            System.err.println("Error checking admin status: " + e.getMessage());
            return false;
        }
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
}

