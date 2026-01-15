package com.mostate.lacrosse.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Team;

public interface TeamRepository extends JpaRepository<Team, UUID> {
    Optional<Team> findFirstByNameIgnoreCase(String name);
}
