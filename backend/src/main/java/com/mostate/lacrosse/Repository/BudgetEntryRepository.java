package com.mostate.lacrosse.Repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.BudgetEntry;

public interface BudgetEntryRepository extends JpaRepository<BudgetEntry, UUID> {
}
