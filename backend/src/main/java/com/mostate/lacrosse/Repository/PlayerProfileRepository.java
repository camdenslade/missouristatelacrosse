package com.mostate.lacrosse.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.PlayerProfile;

public interface PlayerProfileRepository extends JpaRepository<PlayerProfile, UUID> {
    Optional<PlayerProfile> findByFirebaseUid(String firebaseUid);
    Optional<PlayerProfile> findByMergeKey(String mergeKey);
}
