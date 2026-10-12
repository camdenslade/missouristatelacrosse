package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.EventPosItem;

public interface EventPosItemRepository extends JpaRepository<EventPosItem, UUID> {
    List<EventPosItem> findAllByEventIdOrderBySortOrderAsc(UUID eventId);
}
