package com.mostate.lacrosse.Repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.Article;

public interface ArticleRepository extends JpaRepository<Article, UUID> {
    List<Article> findAllByPublishedTrueOrderByCreatedAtDesc();
}
