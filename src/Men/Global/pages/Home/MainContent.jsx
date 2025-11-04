// src/Men/Global/pages/Home/MainContent.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { db } from "../../services/firebaseConfig.js";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

const heroImages = [
  "/assets/hero1.jpg",
  "/assets/hero2.jpg",
  "/assets/hero3.jpg",
  "/assets/hero4.jpg",
  "/assets/hero5.jpg",
  "/assets/hero6.jpg",
  "/assets/hero7.jpg",
];

export default function Hero(){
  const [heroState, setHeroState] = useState({
    articles: [],
    slides: [],
    currentIndex: 0,
    loading: true,
  });

  const { articles, slides, currentIndex, loading } = heroState;

  useEffect(() => {
    let mounted = true;
    let rotationId;

    async function load(){
      try{
        const q = query(
          collection(db, "articles"),
          where("published", "==", true),
          orderBy("createdAt", "desc"),
          limit(7)
        );

        const snap = await getDocs(q);
        if (!mounted) return;

        const fetched = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const articleImages = fetched
          .filter((a) => a.image?.trim())
          .slice(0, 7)
          .map((a) => a.image);

        const needPlaceholders = Math.max(0, 7 - articleImages.length);
        const selectedPlaceholders = heroImages.slice(0, needPlaceholders);
        const finalSlides = [...articleImages, ...selectedPlaceholders];

        setHeroState({
          articles: fetched,
          slides: finalSlides,
          currentIndex: 0,
          loading: false,
        });

        rotationId = setInterval(() => {
          setHeroState((prev) => ({
            ...prev,
            currentIndex: (prev.currentIndex + 1) % finalSlides.length,
          }));
        }, 5000);
      } catch (err){
        console.error("Error fetching articles:", err);
        if (mounted) setHeroState((prev) => ({ ...prev, loading: false }));
      }
    }

    load();

    return () => {
      mounted = false;
      if (rotationId) clearInterval(rotationId);
    };
  }, []);

  const prev = useCallback(() => {
    setHeroState((prev) => ({ ...prev, currentIndex: prev.currentIndex === 0 ? prev.slides.length - 1 : prev.currentIndex - 1,}));
  }, []);

  const next = useCallback(() => {
    setHeroState((prev) => ({ ...prev, currentIndex: (prev.currentIndex + 1)%prev.slides.length,}));
  }, []);

  const currentArticleTitle = useMemo(() => {
    const currentUrl = slides[currentIndex];
    return articles.find(
      (a) => a.image?.trim() && a.image === currentUrl
    )?.title;
  }, [slides, currentIndex, articles]);

  return (
    <section className="relative h-[80vh] md:h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Article Slides */}
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-600">
          Loading hero images...
        </div>
      ) : (
        slides.map((img, i) => (
          <motion.img
            key={img}
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            initial={{ opacity: 0 }}
            animate={i === currentIndex ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover object-top md:[object-position:50%_20%]"
          />
        ))
      )}

      {/* Gray Overlay */}
      <div className="absolute inset-0 bg-gray-500 bg-opacity-40"></div>

      {/* Left-Right Controls */}
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

      {/* Article Title */}
      {!loading && currentArticleTitle && (
        <div className="absolute bottom-4 right-8 text-right">
          <div className="inline-block relative">
            <div className="absolute top-0 left-4 right-0 h-1 bg-[#5E0009] mb-1"></div>
            <h2 className="text-white text-lg md:text-xl font-semibold relative z-10">
              {currentArticleTitle}
            </h2>
          </div>
        </div>
      )}

      {/* Main Text and Buttons */}
      <div className="relative z-10 text-center flex flex-col items-center gap-4">
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