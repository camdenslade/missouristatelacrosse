package com.mostate.lacrosse.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.ParentAccount;

public interface ParentAccountRepository extends JpaRepository<ParentAccount, String> {}
