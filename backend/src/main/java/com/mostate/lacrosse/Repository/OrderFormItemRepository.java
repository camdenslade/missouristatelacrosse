package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.OrderFormItem;

public interface OrderFormItemRepository extends JpaRepository<OrderFormItem, UUID> {
    List<OrderFormItem> findAllByFormIdOrderBySortOrderAsc(UUID formId);
}
