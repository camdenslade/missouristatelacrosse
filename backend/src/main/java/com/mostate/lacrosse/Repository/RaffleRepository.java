package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.mostate.lacrosse.Model.Raffle;

public interface RaffleRepository extends JpaRepository<Raffle, UUID> {
    List<Raffle> findByPublishedTrueOrderByCreatedAtDesc();
    List<Raffle> findAllByOrderByCreatedAtDesc();
    Optional<Raffle> findBySlugAndPublishedTrue(String slug);
    Optional<Raffle> findBySlug(String slug);

    @Query(value = "SELECT COUNT(*) > 0 FROM raffles WHERE stream_data->>'streamKey' = ?1", nativeQuery = true)
    boolean existsByStreamKey(String streamKey);
}
