package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Todo;

public interface TodoRepository extends JpaRepository<Todo, UUID> {
    List<Todo> findBySeason(String season);
    List<Todo> findBySeasonAndActiveTrue(String season);
}
