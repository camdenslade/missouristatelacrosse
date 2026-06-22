package com.mostate.lacrosse.Repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.CustomProductVariant;

public interface CustomProductVariantRepository extends JpaRepository<CustomProductVariant, Long> {
    List<CustomProductVariant> findByProductId(Long productId);
    void deleteByProductId(Long productId);
}
