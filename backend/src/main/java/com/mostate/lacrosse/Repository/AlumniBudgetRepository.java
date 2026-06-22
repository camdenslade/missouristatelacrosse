package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.AlumniBudget;

public interface AlumniBudgetRepository extends JpaRepository<AlumniBudget, UUID> {
    List<AlumniBudget> findByProgramOrderByYearDescDisplayOrderAsc(String program);
}
