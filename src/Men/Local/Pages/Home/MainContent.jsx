// src/Men/Local/Pages/Home/MainContent.jsx
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useState } from "react";
import { db } from "../../../../Services/firebaseConfig.js";

const heroImages = [
  "/assets/hero1.jpg",
  "/assets/hero2.jpg",
  "/assets/hero3.jpg",
  "/assets/hero4.jpg",
  "/assets/hero5.jpg",
  "/assets/hero6.jpg",
  "/assets/hero7.jpg",
];

const fetchArticles = async () => {
  try {
    const q = query(
      collection(db, "articles"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(7)
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch {
    return [];
  }
};

const preloadImages = (urls) =>
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
  const [articles, setArticles] = useState([]);
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      const fetched = await fetchArticles();
      setArticles(fetched);

      const articleImages = fetched
        .filter((a) => a.image && a.image.trim() !== "")
        .map((a) => a.image);
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

  const prev = () => setCurrentIndex((p) => (p === 0 ? slides.length - 1 : p - 1));
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
      <section className="relative h-[80vh] md:h-[90vh] flex items-center justify-center overflow-hidden bg-gray-900">
        {slides.map((img, i) => (
          <motion.img
            key={img}
            src={img}
            alt=""
            initial={{ opacity: 0 }}
            animate={i === currentIndex ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover object-top z-0 md:[object-position:50%_20%]"
          />
        ))}

        <div className="absolute inset-0 bg-black/25 z-10 pointer-events-none"></div>

        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 text-white p-3 rounded-full hover:bg-black/50 transition z-20"
            >
              &#10094;
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 text-white p-3 rounded-full hover:bg-black/50 transition z-20"
            >
              &#10095;
            </button>
          </>
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

        <div className="relative z-20 text-center flex flex-col items-center gap-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Missouri State Lacrosse
          </h1>
          <div className="flex flex-col gap-3 mt-6">
            <a
              href="/recruitment"
              className="bg-[#5E0009] text-white px-6 py-3 font-semibold hover:bg-red-800 transition"
            >
              Recruitment Form
            </a>
            <a
              href="/schedule"
              className="bg-white text-[#5E0009] px-6 py-3 font-semibold hover:bg-gray-200 transition"
            >
              View Schedule
            </a>
            <a
              href="/donate"
              className="bg-[#5E0009] text-white px-6 py-3 font-semibold hover:bg-red-800 transition"
            >
              Donate
            </a>
            <a
              href="/women"
              className="bg-white text-[#5E0009] px-6 py-3 font-semibold hover:bg-gray-200 transition"
            >
              Women's Site
            </a>
          </div>
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
        className="bg-white py-20 text-center px-6"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-[#5E0009] mb-4">Work With Us</h2>
        <p className="max-w-2xl mx-auto text-gray-700 mb-8 text-lg">
          Partner with Missouri State Lacrosse through various sponsorship opportunities.
          Your business can help support student-athletes and grow the game we love.
        </p>
        <a
          href="/sponsorships"
          className="inline-block bg-[#5E0009] text-white px-8 py-3 rounded-md font-semibold hover:bg-red-800 transition"
        >
          Become a Sponsor
        </a>
      </motion.section>
    </>
  );
}
