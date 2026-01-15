package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Game;

public interface GameRepository extends JpaRepository<Game, UUID> {
    List<Game> findAllByOrderByDateAsc();
}
