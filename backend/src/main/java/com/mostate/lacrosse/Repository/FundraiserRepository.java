package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Fundraiser;

public interface FundraiserRepository extends JpaRepository<Fundraiser, UUID> {
    List<Fundraiser> findAllByOrderByCreatedAtDesc();
}
