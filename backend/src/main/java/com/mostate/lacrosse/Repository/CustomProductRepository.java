package com.mostate.lacrosse.Repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.CustomProduct;

public interface CustomProductRepository extends JpaRepository<CustomProduct, Long> {
    List<CustomProduct> findByActiveTrue();
}