package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.mostate.lacrosse.Model.EventRegistration;

public interface EventRegistrationRepository extends JpaRepository<EventRegistration, UUID> {
    List<EventRegistration> findAllByEventId(UUID eventId);
    List<EventRegistration> findAllByTeamId(UUID teamId);
    @Query(
        value = """
            SELECT *
            FROM event_registrations
            WHERE event_id = :eventId
              AND paid = true
              AND teammate_email @> jsonb_build_array(:teammateEmail)
            LIMIT 1
            """,
        nativeQuery = true
    )
    Optional<EventRegistration> findByTeammateEmailAndEventIdAndPaidTrue(
        @Param("teammateEmail") String teammateEmail,
        @Param("eventId") UUID eventId
    );
    Optional<EventRegistration> findByPayerEmailAndEventIdAndPaidTrue(String payerEmail, UUID eventId);
    long countByTeamIdAndPaidTrue(UUID teamId);
}
