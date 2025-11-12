// src/Women/Local/Pages/Home/MainContent.jsx
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useReducer, useState } from "react";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { db } from "../../../../Services/firebaseConfig.js";

const heroImages = [
  "/assets/hero-8.jpg",
  "/assets/hero-9.jpg",
  "/assets/hero-10.jpg",
  "/assets/hero-11.jpg",
  "/assets/hero-12.jpg",
  "/assets/hero-13.jpg",
  "/assets/hero-14.jpg",
  "/assets/hero-15.jpg",
];

const fetchArticles = async () => {
  try {
    const q = query(
      collection(db, "articlesw"),
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
  const { roles } = useAuth();
  const womenRole = roles?.women;

  const [articles, setArticles] = useState([]);
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fundraisers, setFundraisers] = useState([]);
  const [activeFundraiser, setActiveFundraiser] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [form, setForm] = useReducer((s, e) => ({ ...s, ...e }), {
    title: "",
    link: "",
  });

  const loadFundraisers = async () => {
    const q = query(collection(db, "fundraisersw"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setFundraisers(data);
    setActiveFundraiser(data.find((f) => f.active) || null);
  };

  useEffect(() => {
    loadFundraisers();
  }, []);

  const addFundraiser = async (e) => {
    e.preventDefault();
    if (!form.title || !form.link) return;
    await addDoc(collection(db, "fundraisersw"), {
      ...form,
      active: false,
      createdAt: serverTimestamp(),
    });
    setForm({ title: "", link: "" });
    loadFundraisers();
  };

  const toggleActive = async (id, value) => {
    const updates = fundraisers.map(async (f) => {
      const ref = doc(db, "fundraisersw", f.id);
      await updateDoc(ref, { active: f.id === id ? !value : false });
    });
    await Promise.all(updates);
    loadFundraisers();
  };

  const removeFundraiser = async (id) => {
    await deleteDoc(doc(db, "fundraisersw", id));
    loadFundraisers();
  };

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
      {activeFundraiser && (
        <div className="sticky top-0 bg-[#5E0009] text-white px-8 py-3 shadow-md flex flex-col md:flex-row items-center justify-between gap-4 z-30">
          <p className="font-semibold text-center text-base md:text-lg">
            {activeFundraiser.title}
          </p>
          <a
            href={activeFundraiser.link}
            target="_blank"
            rel="noreferrer"
            className="bg-white text-[#5E0009] font-semibold px-5 py-2 hover:bg-gray-200 transition"
          >
            Go to Fundraiser
          </a>
        </div>
      )}

      {womenRole === "admin" && (
        <div className="bg-gray-50 flex justify-center px-8 py-4">
          <button
            onClick={() => setShowManager(true)}
            className="bg-[#5E0009] text-white px-6 py-2 font-semibold hover:bg-red-800 transition"
          >
            Manage Fundraisers
          </button>
        </div>
      )}

      <section
        className={`relative ${
          womenRole === "admin" ? "mt-4" : ""
        } h-[80vh] md:h-[90vh] flex items-center justify-center overflow-hidden bg-gray-900`}
      >
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
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 text-white p-3 hover:bg-black/50 transition z-20"
            >
              &#10094;
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 text-white p-3 hover:bg-black/50 transition z-20"
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
            Missouri State Women's Lacrosse
          </h1>
          <div className="flex flex-col gap-3 mt-6">
            <a
              href="/women/recruitment"
              className="bg-[#5E0009] text-white px-6 py-3 font-semibold hover:bg-red-800 transition"
            >
              Recruitment Form
            </a>
            <a
              href="/women/schedule"
              className="bg-white text-[#5E0009] px-6 py-3 font-semibold hover:bg-gray-200 transition"
            >
              View Schedule
            </a>
            <a
              href="/women/donate"
              className="bg-[#5E0009] text-white px-6 py-3 font-semibold hover:bg-red-800 transition"
            >
              Donate
            </a>
            <a
              href="/"
              className="bg-white text-[#5E0009] px-6 py-3 font-semibold hover:bg-gray-200 transition"
            >
              Men's Site
            </a>
          </div>
        </div>
      </section>

      {showManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white w-[90%] max-w-3xl p-8 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-[#5E0009]">Fundraiser Manager</h3>
              <button
                onClick={() => setShowManager(false)}
                className="text-[#5E0009] text-lg font-semibold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={addFundraiser} className="flex flex-col md:flex-row gap-3 mb-6">
              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ title: e.target.value })}
                className="flex-1 border p-2"
              />
              <input
                placeholder="Link"
                value={form.link}
                onChange={(e) => setForm({ link: e.target.value })}
                className="flex-1 border p-2"
              />
              <button
                type="submit"
                className="bg-[#5E0009] text-white px-4 py-2 hover:bg-red-800"
              >
                Add
              </button>
            </form>
            {fundraisers.length === 0 ? (
              <p className="text-gray-600">No fundraisers yet.</p>
            ) : (
              <div className="space-y-3">
                {fundraisers.map((f) => (
                  <div
                    key={f.id}
                    className="flex justify-between items-center bg-gray-50 border p-3"
                  >
                    <div>
                      <p className="font-semibold">{f.title}</p>
                      <a
                        href={f.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline text-sm"
                      >
                        Link
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(f.id, f.active)}
                        className={`px-3 py-1 ${
                          f.active ? "bg-green-600 text-white" : "bg-gray-300 text-gray-800"
                        }`}
                      >
                        {f.active ? "Active" : "Activate"}
                      </button>
                      <button
                        onClick={() => removeFundraiser(f.id)}
                        className="px-3 py-1 bg-red-500 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
        <h2 className="text-3xl md:text-4xl font-bold text-[#5E0009] mb-4">Work With Us</h2>
        <p className="max-w-2xl mx-auto text-gray-700 mb-8 text-lg">
          Partner with Missouri State Women's Lacrosse through various sponsorship opportunities.
          Your business can help support student-athletes and grow the game we love.
        </p>
        <a
          href="/women/sponsorships"
          className="inline-block bg-[#5E0009] text-white px-8 py-3 font-semibold hover:bg-red-800 transition"
        >
          Become a Sponsor
        </a>
      </motion.section>
    </>
  );
}
