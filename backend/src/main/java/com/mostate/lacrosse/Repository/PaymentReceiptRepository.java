package com.mostate.lacrosse.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.PaymentReceipt;

public interface PaymentReceiptRepository extends JpaRepository<PaymentReceipt, UUID> {
    Optional<PaymentReceipt> findByOrderId(String orderId);
}
