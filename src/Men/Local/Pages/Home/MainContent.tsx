import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, HandCoins, Instagram, Plus, Settings, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useReducer, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { useSponsors } from "../../../../Global/Common/hooks/useSponsors";
import InstagramManagerModal from "../../../../Global/Common/InstagramManagerModal";
import SponsorLogos from "../../../../Global/Common/SponsorLogos";
import { validateText, validateUrl } from "../../../../Global/Common/utils/validation";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import type { ApiArticle, ApiFundraiser } from "../../../../types/api";


const heroImages = [
  "/assets/hero1.jpg",
  "/assets/hero2.jpg",
  "/assets/hero3.jpg",
  "/assets/hero4.jpg",
  "/assets/hero5.jpg",
  "/assets/hero6.jpg",
  "/assets/hero7.jpg",
];

const fetchArticles = async (): Promise<ApiArticle[]> => {
  try {
    return await apiRequest<ApiArticle[]>("/api/articles?published=true&limit=7");
  } catch {
    return [];
  }
};

const preloadImages = (urls: string[]) =>
  Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = url;
          img.onload = resolve;
          img.onerror = resolve;
        })
    )
  );

export default function MainContent() {
  const { roles } = useAuth();
  const menRole = roles?.men;
  const { sponsors } = useSponsors();

  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [slides, setSlides] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fundraisers, setFundraisers] = useState<ApiFundraiser[]>([]);
  const [activeFundraiser, setActiveFundraiser] = useState<ApiFundraiser | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [showInstagramManager, setShowInstagramManager] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [fundraiserError, setFundraiserError] = useState("");
  type FundraiserFormState = {
    title: string;
    link: string;
  };
  const [form, setForm] = useReducer(
    (s: FundraiserFormState, e: Partial<FundraiserFormState>) => ({ ...s, ...e }),
    {
      title: "",
      link: "",
    }
  );

  const loadFundraisers = async () => {
    const data = await apiRequest<ApiFundraiser[]>("/api/fundraisers");
    setFundraisers(data);
    setActiveFundraiser(data.find((f) => f.active) || null);
  };

  useEffect(() => {
    loadFundraisers();
  }, []);

  const addFundraiser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFundraiserError("");
    const validationError =
      validateText(form.title, "Title", { required: true, max: 80 }) ||
      validateUrl(form.link, "Link", { required: true });
    if (validationError) {
      setFundraiserError(validationError);
      return;
    }
    await apiRequest("/api/fundraisers", {
      method: "POST",
      json: {
        ...form,
        active: false,
      },
    });
    setForm({ title: "", link: "" });
    loadFundraisers();
  };

  const toggleActive = async (id: string, value: boolean | null | undefined) => {
    const updates = fundraisers.map((f) =>
      apiRequest(`/api/fundraisers/${f.id}`, {
        method: "PUT",
        json: { ...f, active: f.id === id ? !value : false },
      })
    );
    await Promise.all(updates);
    loadFundraisers();
  };

  const removeFundraiser = async (id: string) => {
    await apiRequest(`/api/fundraisers/${id}`, { method: "DELETE" });
    loadFundraisers();
  };

  useEffect(() => {
    const loadAll = async () => {
      const fetched = await fetchArticles();
      setArticles(fetched);
      const articleImages = fetched
        .filter((a) => a.image && a.image.trim() !== "")
        .map((a) => a.image as string);
      const finalSlides = [
        ...articleImages,
        ...heroImages.slice(0, Math.max(0, 7 - articleImages.length)),
      ].slice(0, 7);
      await preloadImages(finalSlides);
      setSlides(finalSlides);
      setLoaded(true);
    };
    loadAll();
  }, []);

  useLayoutEffect(() => {
    if (!loaded || slides.length <= 1) return;
    const id = setTimeout(() => setCurrentIndex((p) => (p + 1) % slides.length), 5000);
    return () => clearTimeout(id);
  }, [currentIndex, slides, loaded]);

  const next = () => setCurrentIndex((p) => (p + 1) % slides.length);

  const currentUrl = slides[currentIndex];
  const currentArticleTitle = articles.find(
    (a) => a.image && a.image.trim() !== "" && a.image === currentUrl
  )?.title;

  if (!loaded) {
    return (
      <section className="relative h-[80vh] md:h-[90vh] flex items-center justify-center bg-gray-100">
        <div className="text-gray-600 animate-pulse">Loading content...</div>
      </section>
    );
  }

  return (
    <>
      {activeFundraiser && (
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white shadow-lg overflow-hidden">
          <div className="relative px-6 py-3.5">
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite] pointer-events-none" />
            <style>{`@keyframes shimmer{0%,100%{transform:translateX(-100%)}50%{transform:translateX(100%)}}`}</style>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3 relative">
              <p className="font-bold text-base md:text-lg tracking-wide text-center md:text-left">
                {activeFundraiser.title}
              </p>

              {activeFundraiser.link ? (
                <a
                  href={activeFundraiser.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white text-[#5E0009] font-bold px-5 py-2 rounded-full hover:bg-gray-200 transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap"
                >
                  Donate Now
                  <ChevronRight size={16} strokeWidth={3} />
                </a>
              ) : (
                <Link
                  to={activeFundraiser.slug ? `/fundraiser/${activeFundraiser.slug}` : "/donate"}
                  className="inline-flex items-center gap-1.5 bg-white text-[#5E0009] font-bold px-5 py-2 rounded-full hover:bg-gray-200 transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap"
                >
                  Donate Now
                  <ChevronRight size={16} strokeWidth={3} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {menRole === "admin" && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          <AnimatePresence>
            {adminMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-end gap-2"
              >
                <button
                  onClick={() => {
                    setShowManager(true);
                    setAdminMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 bg-white text-[#5E0009] px-5 py-2.5 rounded-full font-semibold shadow-lg hover:bg-gray-100 transition whitespace-nowrap"
                >
                  <HandCoins size={16} />
                  Manage Fundraisers
                </button>
                <button
                  onClick={() => {
                    setShowInstagramManager(true);
                    setAdminMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 bg-white text-[#5E0009] px-5 py-2.5 rounded-full font-semibold shadow-lg hover:bg-gray-100 transition whitespace-nowrap"
                >
                  <Instagram size={16} />
                  Manage Instagram Feed
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setAdminMenuOpen((v) => !v)}
            aria-label="Admin options"
            className="w-14 h-14 bg-[#5E0009] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#7a0012] hover:shadow-xl transition-all"
          >
            <Settings
              size={22}
              className={`transition-transform duration-300 ${adminMenuOpen ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      )}

      <InstagramManagerModal
        open={showInstagramManager}
        onClose={() => setShowInstagramManager(false)}
        contentKey="instagramFeed"
      />

      <section
        className={`relative ${
          menRole === "admin" ? "mt-4" : ""
        } h-[80vh] md:h-[90vh] flex items-center justify-start overflow-hidden bg-gray-900 pb-24 md:pb-28`}
      >
        {slides.map((img, i) => (
          <motion.img
            key={img}
            src={img}
            alt=""
            initial={{ opacity: 0 }}
            animate={i === currentIndex ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover object-top z-0 md:object-[50%_20%]"
          />
        ))}
        <div className="absolute inset-0 bg-black/25 z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/30 to-transparent z-10 pointer-events-none"></div>
        {slides.length > 1 && (
          <button
            onClick={next}
            aria-label="Next slide"
            className="hidden md:block absolute right-6 top-1/2 -translate-y-1/2 text-white hover:text-white/70 transition z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          >
            <ChevronRight size={80} strokeWidth={3} />
          </button>
        )}
        {currentArticleTitle && (
          <div className="absolute bottom-4 right-8 text-right z-20">
            <div className="inline-block relative">
              <div className="absolute top-0 left-4 right-0 h-1 bg-[#5E0009] mb-1"></div>
              <h2 className="text-white text-lg md:text-xl font-semibold relative z-10">
                {currentArticleTitle}
              </h2>
            </div>
          </div>
        )}
        <div className="relative z-20 w-full max-w-3xl px-6 md:px-12 flex flex-col items-start gap-5 text-left">
          <div className="flex items-center gap-3 text-white/80 text-xs md:text-sm font-semibold uppercase tracking-[0.2em]">
            <span className="h-px w-6 bg-white/60" />
            MCLA Division II Lacrosse
            <span className="h-px w-6 bg-white/60" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold uppercase leading-[0.95] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Missouri State
            <br />
            Lacrosse
          </h1>
          <p className="max-w-xl text-white/90 text-base md:text-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            Built on our four pillars of attitude, effort, example, and commitment.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <a
              href="/recruitment"
              className="bg-white text-[#5E0009] px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
            >
              Recruitment Form
            </a>
            <a
              href="/schedule"
              className="border border-white/70 text-white px-6 py-3 rounded-full font-semibold hover:bg-white/10 transition"
            >
              View Schedule
            </a>
            <a
              href="/donate"
              className="bg-[#5E0009] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#7a0012] transition"
            >
              Donate
            </a>
            <a
              href="/women"
              className="text-white font-semibold uppercase text-sm tracking-wide inline-flex items-center gap-1.5 hover:text-white/70 transition"
            >
              Women's Site
              <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-sm border-t border-white/10">
          <div className="w-full px-6 md:px-12 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">
                League
              </div>
              <div className="text-white font-bold text-sm md:text-base uppercase">
                Men's Collegiate Lacrosse Association
              </div>
            </div>
            <div>
              <div className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">
                Conference
              </div>
              <div className="text-white font-bold text-sm md:text-base uppercase">
                Lone Star Alliance
              </div>
            </div>
            <div>
              <div className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">
                Recruitment Status
              </div>
              <div className="text-white font-bold text-sm md:text-base uppercase">
                Still Open
              </div>
            </div>
            <div>
              <div className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">
                Home Turf
              </div>
              <div className="text-white font-bold text-sm md:text-base uppercase">
                Allison North Stadium
              </div>
            </div>
          </div>
        </div>
      </section>

      {showManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl shadow-2xl overflow-hidden bg-white">
            <div className="relative px-8 py-6 bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite] pointer-events-none" />
              <style>{`@keyframes shimmer{0%,100%{transform:translateX(-100%)}50%{transform:translateX(100%)}}`}</style>
              <div className="relative flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Admin
                  </div>
                  <h3 className="text-xl font-bold leading-tight text-white">Fundraiser Manager</h3>
                </div>
                <button
                  onClick={() => setShowManager(false)}
                  className="rounded-full p-1.5 text-white hover:bg-white/15 transition"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-8">
              <form onSubmit={addFundraiser} className="flex flex-col md:flex-row gap-3 mb-8">
                <input
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ title: e.target.value })}
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
                />
                <input
                  placeholder="Link"
                  value={form.link}
                  onChange={(e) => setForm({ link: e.target.value })}
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 bg-[#5E0009] text-white px-5 py-2.5 rounded-full font-semibold hover:bg-[#7a0012] transition whitespace-nowrap"
                >
                  <Plus size={16} />
                  Add
                </button>
              </form>
              {fundraiserError && (
                <p className="text-sm text-red-600 mb-4">{fundraiserError}</p>
              )}
              {fundraisers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No fundraisers yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                  {fundraisers.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex items-start gap-3">
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                            f.active ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{f.title}</p>
                          {f.link && (
                            <a
                              href={f.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 hover:text-[#5E0009] text-xs truncate block transition"
                            >
                              {f.link}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleActive(f.id, f.active)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition ${
                            f.active
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {f.active ? "Active" : "Activate"}
                        </button>
                        <button
                          onClick={() => removeFundraiser(f.id)}
                          aria-label="Delete fundraiser"
                          className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
        className="bg-white py-20 text-center px-6"
      >
        <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          <span className="h-px w-6 bg-[#5E0009]/40" />
          Partner With Us
          <span className="h-px w-6 bg-[#5E0009]/40" />
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Work With Us</h2>
        <p className="max-w-2xl mx-auto text-gray-600 mb-8 text-lg">
          Partner with Missouri State Lacrosse through various sponsorship opportunities.
          Your business can help support student-athletes and grow the game we love.
        </p>
        {sponsors.length > 0 && (
          <div className="mb-8">
            <SponsorLogos sponsors={sponsors} layout="row" maxHeight={80} />
          </div>
        )}
        <a
          href="/sponsorships"
          className="inline-block bg-[#5E0009] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#7a0012] transition"
        >
          Become a Sponsor
        </a>
      </motion.section>
    </>
  );
}

