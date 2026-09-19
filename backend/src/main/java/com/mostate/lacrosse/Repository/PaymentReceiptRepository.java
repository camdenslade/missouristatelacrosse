package com.mostate.lacrosse.Repository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import com.mostate.lacrosse.Model.PaymentReceipt;

public interface PaymentReceiptRepository extends JpaRepository<PaymentReceipt, UUID> {
    Optional<PaymentReceipt> findByOrderId(String orderId);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM PaymentReceipt r WHERE r.source = :source AND r.status = 'COMPLETED'")
    BigDecimal sumAmountBySource(@Param("source") String source);

    /**
     * Atomically marks the confirmation email as sent. Returns 1 for the one caller that wins
     * and 0 for everyone else, so an order is never mailed twice.
     */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE PaymentReceipt r SET r.receiptSentAt = CURRENT_TIMESTAMP WHERE r.orderId = :orderId AND r.receiptSentAt IS NULL")
    int claimReceiptSend(@Param("orderId") String orderId);

    /** Undoes a claim when the email could not actually be sent, so a retry can succeed. */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE PaymentReceipt r SET r.receiptSentAt = NULL WHERE r.orderId = :orderId")
    int releaseReceiptSend(@Param("orderId") String orderId);
}
