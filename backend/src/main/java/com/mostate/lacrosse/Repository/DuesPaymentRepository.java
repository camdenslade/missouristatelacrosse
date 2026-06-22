package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.DuesPayment;

public interface DuesPaymentRepository extends JpaRepository<DuesPayment, UUID> {
    List<DuesPayment> findByPlayerIdOrderByCreatedAtDesc(UUID playerId);
}
