package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Fundraiser;

public interface FundraiserRepository extends JpaRepository<Fundraiser, UUID> {
    List<Fundraiser> findAllByOrderByCreatedAtDesc();
    List<Fundraiser> findAllByOrderByActiveDescCreatedAtDesc();
    List<Fundraiser> findByPublishedTrueOrderByActiveDescCreatedAtDesc();
    Optional<Fundraiser> findBySlug(String slug);
    Optional<Fundraiser> findBySlugAndPublishedTrue(String slug);
    List<Fundraiser> findByProgramAndActiveTrue(String program);
}
