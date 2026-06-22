package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mostate.lacrosse.Model.Game;

public interface GameRepository extends JpaRepository<Game, UUID> {
    List<Game> findAllByOrderByDateAsc();

    @Query(value = "SELECT * FROM games WHERE data->>'streamKey' = :streamKey LIMIT 1", nativeQuery = true)
    Optional<Game> findByStreamKey(@Param("streamKey") String streamKey);

    @Query(value = "SELECT * FROM games WHERE data->>'isLive' = 'true'", nativeQuery = true)
    List<Game> findAllLive();
}
