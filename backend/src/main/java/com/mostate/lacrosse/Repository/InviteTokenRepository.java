package com.mostate.lacrosse.Repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.InviteToken;

public interface InviteTokenRepository extends JpaRepository<InviteToken, UUID> {}
