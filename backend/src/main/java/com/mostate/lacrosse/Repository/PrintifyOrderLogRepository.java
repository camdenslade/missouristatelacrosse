package com.mostate.lacrosse.Repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.PrintifyOrderLog;

public interface PrintifyOrderLogRepository extends JpaRepository<PrintifyOrderLog, UUID> {}
