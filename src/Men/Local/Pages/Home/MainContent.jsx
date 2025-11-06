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
  } catch (err) {
    console.error("Error fetching articles:", err);
    return [];
  }
};

export default function Hero() {
  const [articles, setArticles] = useState([]);
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const fetched = await fetchArticles();
      setArticles(fetched);
      const filledSlides = fetched.map(
        (a, i) => (a.image && a.image.trim() !== "" ? a.image : heroImages[i % heroImages.length])
      );
      const finalSlides =
        filledSlides.length < 7
          ? [...filledSlides, ...heroImages.slice(0, 7 - filledSlides.length)]
          : filledSlides.slice(0, 7);
      setSlides(finalSlides);
      setLoading(false);
    };
    load();
  }, []);

  useLayoutEffect(() => {
    if (loading || slides.length <= 1) return;
    const id = setTimeout(
      () => setCurrentIndex((p) => (p + 1) % slides.length),
      5000
    );
    return () => clearTimeout(id);
  }, [currentIndex, slides, loading]);

  const prev = () =>
    setCurrentIndex((p) => (p === 0 ? slides.length - 1 : p - 1));
  const next = () => setCurrentIndex((p) => (p + 1) % slides.length);

  const currentUrl = slides[currentIndex];
  const currentArticleTitle = articles.find(
    (a) => a.image && a.image.trim() !== "" && a.image === currentUrl
  )?.title;

  return (
    <section className="relative h-[80vh] md:h-[90vh] flex items-center justify-center overflow-hidden bg-gray-900">
      {!loading ? (
      slides.map((img, i) => (
        <motion.img
          key={img}
          src={img}
          alt=""
          initial={{ opacity: 0 }}
          animate={i === currentIndex ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1.0, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-cover object-top z-0 md:[object-position:50%_20%]"
        />
      ))
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-600 z-0">
        Loading hero images...
      </div>
    )}

    <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none"></div>


      {!loading && slides.length > 1 && (
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

      {!loading && currentArticleTitle && (
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
  );
}
