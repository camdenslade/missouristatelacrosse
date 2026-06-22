package com.mostate.lacrosse.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mostate.lacrosse.Model.StreamKey;

public interface StreamKeyRepository extends JpaRepository<StreamKey, UUID> {

    Optional<StreamKey> findByKeyCode(String keyCode);

    List<StreamKey> findByGameIdOrderByCreatedAtDesc(String gameId);

    @Query("SELECT COUNT(s) FROM StreamSession s WHERE s.key.id = :keyId AND s.lastHeartbeat > :cutoff")
    long countActiveSessions(@Param("keyId") UUID keyId, @Param("cutoff") Instant cutoff);
}
