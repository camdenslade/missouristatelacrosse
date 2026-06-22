package com.mostate.lacrosse.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mostate.lacrosse.Model.StreamSession;

public interface StreamSessionRepository extends JpaRepository<StreamSession, UUID> {

    Optional<StreamSession> findBySessionToken(String sessionToken);

    @Modifying
    @Query("DELETE FROM StreamSession s WHERE s.key.id = :keyId")
    void deleteByKeyId(@Param("keyId") UUID keyId);

    @Modifying
    @Query("DELETE FROM StreamSession s WHERE s.lastHeartbeat < :cutoff")
    void deleteExpiredSessions(@Param("cutoff") java.time.Instant cutoff);
}
