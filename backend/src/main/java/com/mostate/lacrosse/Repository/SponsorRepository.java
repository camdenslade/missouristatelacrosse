package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Sponsor;

public interface SponsorRepository extends JpaRepository<Sponsor, UUID> {
    List<Sponsor> findAllByOrderByDisplayOrderAsc();
}
