// src/Men/Local/Pages/Gallery/GalleryMain.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useAuth } from "../../../../Global/Context/AuthContext.jsx";
import { getGallery } from "../../../../Global/Gallery/galleryService.js";
import GalleryEditModal from "./Modals/GalleryEdit.jsx";
import GalleryUploadModal from "./Modals/GalleryUpload.jsx";

export default function Gallery({ userRole }) {
  const [state, setState] = useState({
    galleries: {},
    loading: true,
    error: "",
    lightbox: { open: false, images: [], index: 0 },
    showUploadModal: false,
    showEditModal: false,
  });

  const { galleries, loading, error, lightbox, showUploadModal, showEditModal } = state;
  const { user } = useAuth();

  const canUpload = useMemo(() => {
    if (!user) return false;
    const normalized = userRole?.toLowerCase?.();
    return normalized === "admin" || normalized === "player";
  }, [user, userRole]);

  const isAdmin = userRole === "admin";

  const loadGallery = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getGallery();
      const formatted = {};
      Object.entries(data).forEach(([key, value]) => {
        formatted[key] = value.urls || [];
      });
      setState((prev) => ({ ...prev, galleries: formatted, loading: false }));
    } catch (err) {
      console.error("Gallery fetch failed:", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load gallery. Please try again later.",
      }));
    }
  }, []);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const formatFolderName = useCallback((name) => {
    const match = name.match(/(.*?)-(\d{4})$/);
    return match ? `${match[1].trim()} — ${match[2]}` : name.replace(/-/g, " ");
  }, []);

  const openLightbox = useCallback((images, index = 0) => {
    setState((prev) => ({ ...prev, lightbox: { open: true, images, index } }));
  }, []);

  const closeLightbox = useCallback(() => {
    setState((prev) => ({ ...prev, lightbox: { open: false, images: [], index: 0 } }));
  }, []);

  const galleryGrid = useMemo(() => {
    if (!Object.keys(galleries).length)
      return <p className="text-gray-500 italic">No galleries yet.</p>;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-6 max-w-6xl mx-auto">
        {Object.entries(galleries).map(([folderName, images]) => {
          if (!images.length) return null;
          const coverUrl = images[0];
          return (
            <div
              key={folderName}
              className="cursor-pointer bg-gray-50 shadow-md hover:shadow-lg overflow-hidden transition-all flex flex-col"
              onClick={() => openLightbox(images)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
                <img
                  src={coverUrl}
                  alt={folderName}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => (e.target.style.display = "none")}
                />
              </div>
              <div className="py-3 px-4 text-center flex flex-col flex-grow justify-between">
                <h3 className="text-lg font-semibold text-[#5E0009] leading-snug break-words">
                  {formatFolderName(folderName)}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{images.length} photos</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [galleries, openLightbox, formatFolderName]);

  if (loading)
    return <p className="text-center text-gray-600 py-10 italic">Loading gallery...</p>;

  if (error)
    return (
      <div className="text-center text-red-600 py-10">
        <p className="italic">{error}</p>
        <button
          onClick={loadGallery}
          className="mt-4 bg-[#5E0009] text-white px-4 py-2 rounded hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );

  return (
    <section className="py-12 bg-white text-center animate-fadeIn relative">
      <h2 className="text-3xl font-bold text-[#5E0009] mb-8">
        Men's Lacrosse Photo Gallery
      </h2>
      {canUpload && (
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setState((p) => ({ ...p, showUploadModal: true }))}
            className="bg-[#5E0009] text-white px-4 py-2 rounded hover:bg-red-800"
          >
            Upload Photo
          </button>
        </div>
      )}
      {isAdmin && (
        <div className="absolute top-4 right-36">
          <button
            onClick={() => setState((p) => ({ ...p, showEditModal: true }))}
            className="bg-[#7a7979] text-white px-4 py-2 rounded hover:bg-[#5E0009]"
          >
            Edit Gallery
          </button>
        </div>
      )}
      {galleryGrid}
      {lightbox.open && (
        <Lightbox
          open={lightbox.open}
          close={closeLightbox}
          index={lightbox.index}
          slides={lightbox.images.map((src) => ({ src }))}
        />
      )}
      {showEditModal && (
        <GalleryEditModal
          galleries={galleries}
          onClose={() => setState((p) => ({ ...p, showEditModal: false }))}
          onRefresh={loadGallery}
        />
      )}
      {showUploadModal && (
        <GalleryUploadModal
          onClose={() => setState((p) => ({ ...p, showUploadModal: false }))}
          onUpload={loadGallery}
        />
      )}
    </section>
  );
}
