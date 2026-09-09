package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.PaymentCard;

public interface PaymentCardRepository extends JpaRepository<PaymentCard, UUID> {
    List<PaymentCard> findBySeason(String season);
    List<PaymentCard> findBySeasonAndActiveTrue(String season);
}
