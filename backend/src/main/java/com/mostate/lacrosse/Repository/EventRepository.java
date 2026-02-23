package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Event;

public interface EventRepository extends JpaRepository<Event, UUID> {
    List<Event> findAllByOrderByStartTimeAsc();
    List<Event> findByPublishedTrueOrderByStartTimeAsc();
    Optional<Event> findBySlug(String slug);
    Optional<Event> findBySlugAndPublishedTrue(String slug);
}
