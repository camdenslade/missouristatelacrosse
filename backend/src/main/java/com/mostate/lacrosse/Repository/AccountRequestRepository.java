package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.AccountRequestModel;

public interface AccountRequestRepository extends JpaRepository<AccountRequestModel, UUID> {
    List<AccountRequestModel> findAllByProgramIgnoreCase(String program);
}
