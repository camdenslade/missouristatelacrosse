package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.OrderForm;

public interface OrderFormRepository extends JpaRepository<OrderForm, UUID> {
    List<OrderForm> findAllByActiveTrueOrderByCreatedAtDesc();
}
