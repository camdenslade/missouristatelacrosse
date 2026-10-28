package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.OrderFormSubmission;

public interface OrderFormSubmissionRepository extends JpaRepository<OrderFormSubmission, UUID> {
    List<OrderFormSubmission> findAllByFormIdOrderByCreatedAtDesc(UUID formId);
    List<OrderFormSubmission> findAllByFormIdAndPlayerIdOrderByCreatedAtDesc(UUID formId, UUID playerId);
}
