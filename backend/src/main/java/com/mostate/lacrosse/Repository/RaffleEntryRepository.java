package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.RaffleEntry;

public interface RaffleEntryRepository extends JpaRepository<RaffleEntry, UUID> {
    List<RaffleEntry> findAllByRaffleIdOrderByCreatedAtDesc(UUID raffleId);
    Optional<RaffleEntry> findTopByRaffleIdAndPaidTrueOrderByBidAmountDesc(UUID raffleId);
    long countByRaffleIdAndPaidTrue(UUID raffleId);
}
