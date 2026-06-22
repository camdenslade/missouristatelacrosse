package com.mostate.lacrosse.Repository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mostate.lacrosse.Model.PaymentReceipt;

public interface PaymentReceiptRepository extends JpaRepository<PaymentReceipt, UUID> {
    Optional<PaymentReceipt> findByOrderId(String orderId);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM PaymentReceipt r WHERE r.source = :source AND r.status = 'COMPLETED'")
    BigDecimal sumAmountBySource(@Param("source") String source);
}
