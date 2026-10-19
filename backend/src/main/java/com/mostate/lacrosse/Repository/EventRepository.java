package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Event;

public interface EventRepository extends JpaRepository<Event, UUID> {
    List<Event> findAllByOrderByStartTimeAsc();
    List<Event> findByPublishedTrueAndArchivedFalseOrderByStartTimeAsc();
    List<Event> findByArchivedFalseOrderByStartTimeAsc();
    Optional<Event> findBySlug(String slug);
    Optional<Event> findBySlugAndPublishedTrueAndArchivedFalse(String slug);
}
