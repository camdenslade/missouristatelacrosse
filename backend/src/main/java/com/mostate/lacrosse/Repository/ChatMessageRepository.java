package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    List<ChatMessage> findTop50ByGameIdAndDeletedFalseOrderByCreatedAtAsc(String gameId);
}
