package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.TodoStatus;

public interface TodoStatusRepository extends JpaRepository<TodoStatus, UUID> {
    List<TodoStatus> findByPlayerId(UUID playerId);
    List<TodoStatus> findByTodoId(UUID todoId);
    Optional<TodoStatus> findByTodoIdAndPlayerId(UUID todoId, UUID playerId);
    void deleteByTodoId(UUID todoId);
}
