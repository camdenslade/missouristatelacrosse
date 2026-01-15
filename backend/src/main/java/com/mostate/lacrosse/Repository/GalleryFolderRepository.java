package com.mostate.lacrosse.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.mostate.lacrosse.Model.GalleryFolder;

public interface GalleryFolderRepository extends JpaRepository<GalleryFolder, String> {}
