package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Raffle;

public interface RaffleRepository extends JpaRepository<Raffle, UUID> {
    List<Raffle> findByPublishedTrueOrderByCreatedAtDesc();
    List<Raffle> findAllByOrderByCreatedAtDesc();
    Optional<Raffle> findBySlugAndPublishedTrue(String slug);
    Optional<Raffle> findBySlug(String slug);
}
