package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.ComplianceFiling;

public interface ComplianceFilingRepository extends JpaRepository<ComplianceFiling, UUID> {
    List<ComplianceFiling> findAllByOrderByDueDateAsc();
}
