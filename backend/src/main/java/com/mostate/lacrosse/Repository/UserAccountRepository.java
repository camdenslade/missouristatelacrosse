package com.mostate.lacrosse.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.UserAccount;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
    Optional<UserAccount> findByFirebaseUid(String firebaseUid);
    Optional<UserAccount> findFirstByEmailIgnoreCase(String email);
    Optional<UserAccount> findFirstByPlayerId(UUID playerId);
    java.util.List<UserAccount> findAllByOrderByDisplayNameAsc();
}
