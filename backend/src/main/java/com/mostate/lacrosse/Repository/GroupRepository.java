package com.mostate.lacrosse.Repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Group;

public interface GroupRepository extends JpaRepository<Group, UUID> {
    Optional<Group> findFirstByNameIgnoreCase(String name);
}
