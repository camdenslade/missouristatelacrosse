import { useCallback, useEffect, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { getGallery } from "./hooks/galleryService";
import GalleryEditModal from "./Modals/GalleryEdit";
import GalleryUploadModal from "./Modals/GalleryUpload";
import { useAuth } from "../../../../Global/Context/AuthContext";

export default function WGallery() {
  type LightboxState = {
    open: boolean;
    images: string[];
    index: number;
  };
  type GalleryState = {
    galleries: Record<string, string[]>;
    loading: boolean;
    error: string;
    lightbox: LightboxState;
    showUploadModal: boolean;
    showEditModal: boolean;
  };
  const [state, setState] = useState<GalleryState>({
    galleries: {},
    loading: true,
    error: "",
    lightbox: { open: false, images: [], index: 0 },
    showUploadModal: false,
    showEditModal: false,
  });

  const { galleries, loading, error, lightbox, showUploadModal, showEditModal } = state;
  const { user, roles } = useAuth();

  const program = useMemo(
    () => (window.location.pathname.toLowerCase().includes("/women") ? "women" : "men"),
    []
  );

  const programRole = roles?.[program]?.toLowerCase?.() || "player";

  const canUpload = useMemo(() => {
    if (!user) return false;
    return ["admin", "player"].includes(programRole);
  }, [user, programRole]);

  const isAdmin = programRole === "admin";

  const loadGallery = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getGallery();
      const formatted: Record<string, string[]> = {};
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

  const formatFolderName = useCallback((name: string) => {
    const match = name.match(/(.*?)-(\d{4})$/);
    return match ? `${match[1].trim()} - ${match[2]}` : name.replace(/-/g, " ");
  }, []);

  const openLightbox = useCallback((images: string[], index = 0) => {
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
              className="cursor-pointer bg-white rounded-2xl shadow-sm hover:shadow-lg overflow-hidden transition-all flex flex-col"
              onClick={() => openLightbox(images)}
            >
              <div className="relative aspect-4/3 overflow-hidden bg-gray-200">
                <img
                  src={coverUrl}
                  alt={folderName}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <div className="py-3 px-4 text-center flex flex-col grow justify-between">
                <h3 className="text-lg font-semibold text-[#5E0009] leading-snug wrap-break-word">
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
          className="mt-4 bg-[#5E0009] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#7a0012] transition"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Photo Gallery
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">
          {program === "women"
            ? "Women's Lacrosse Photo Gallery"
            : "Men's Lacrosse Photo Gallery"}
        </h1>

        {(canUpload || isAdmin) && (
          <div className="flex justify-center gap-3 flex-wrap mt-6">
            {canUpload && (
              <button
                onClick={() => setState((p) => ({ ...p, showUploadModal: true }))}
                className="bg-white text-[#5E0009] px-5 py-2.5 rounded-full font-semibold hover:bg-gray-200 transition"
              >
                Upload Photo
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setState((p) => ({ ...p, showEditModal: true }))}
                className="bg-white/10 text-white border border-white/30 px-5 py-2.5 rounded-full font-semibold hover:bg-white/20 transition"
              >
                Edit Gallery
              </button>
            )}
          </div>
        )}
      </div>

      <section className="py-12 bg-gray-50 text-center animate-fadeIn">
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
    </div>
  );
}

