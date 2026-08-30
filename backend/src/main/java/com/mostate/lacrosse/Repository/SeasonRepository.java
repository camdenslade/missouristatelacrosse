package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Season;

public interface SeasonRepository extends JpaRepository<Season, UUID> {
    List<Season> findAllByOrderBySortOrderAscCodeAsc();
    Optional<Season> findByActiveTrue();
    Optional<Season> findByCode(String code);
    boolean existsByCode(String code);
}
