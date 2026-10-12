package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.BoardCalendarEvent;

public interface BoardCalendarEventRepository extends JpaRepository<BoardCalendarEvent, UUID> {
    List<BoardCalendarEvent> findAllByOrderByEventDateAsc();
}
