package com.mostate.lacrosse.Repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.SponsorRequest;

public interface SponsorRequestRepository extends JpaRepository<SponsorRequest, UUID> {}
