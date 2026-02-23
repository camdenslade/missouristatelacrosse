package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.EventTeam;

public interface EventTeamRepository extends JpaRepository<EventTeam, UUID> {
    List<EventTeam> findAllByEventId(UUID eventId);
    long countByEventIdAndComplete(UUID eventId, boolean complete);
}
