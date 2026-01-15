package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Player;

public interface PlayerRepository extends JpaRepository<Player, UUID> {
    List<Player> findAllBySeason(String season);
    List<Player> findAllByProfileId(UUID profileId);
    Optional<Player> findFirstByNameIgnoreCaseAndSeason(String name, String season);
    Optional<Player> findFirstByNameIgnoreCase(String name);
    List<Player> findAllByUserUid(String userUid);
}
