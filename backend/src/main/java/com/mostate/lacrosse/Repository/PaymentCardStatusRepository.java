package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.PaymentCardStatus;

public interface PaymentCardStatusRepository extends JpaRepository<PaymentCardStatus, UUID> {
    List<PaymentCardStatus> findByPlayerId(UUID playerId);
    List<PaymentCardStatus> findByCardId(UUID cardId);
    Optional<PaymentCardStatus> findByCardIdAndPlayerId(UUID cardId, UUID playerId);
    void deleteByCardId(UUID cardId);
}
