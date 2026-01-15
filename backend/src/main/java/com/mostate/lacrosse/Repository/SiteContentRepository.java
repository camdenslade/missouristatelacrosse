package com.mostate.lacrosse.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.SiteContent;

public interface SiteContentRepository extends JpaRepository<SiteContent, String> {}
