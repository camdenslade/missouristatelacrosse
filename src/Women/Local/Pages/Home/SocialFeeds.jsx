// src/Women/Local/Pages/Home/SocialFeeds.jsx
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useReducer } from "react";
import { A11y, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { useAuth } from "../../../../Global/Context/AuthContext.jsx";
import { db } from "../../../../Services/firebaseConfig.js";

import "swiper/css";
import "swiper/css/pagination";

const initialState = {
  postUrls: [],
  loading: true,
  error: "",
  newUrl: "",
  adding: false,
  isMobile: window.innerWidth < 768,
};

function feedReducer(state, action) {
  switch (action.type) {
    case "SET_POSTS":
      return { ...state, postUrls: action.payload, loading: false, error: "" };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_NEW_URL":
      return { ...state, newUrl: action.payload };
    case "SET_ADDING":
      return { ...state, adding: action.payload };
    case "SET_MOBILE":
      return { ...state, isMobile: action.payload };
    default:
      return state;
  }
}

export default function SocialFeeds(){
    const [state, dispatch] = useReducer(feedReducer, initialState);
    const { postUrls, loading, error, newUrl, adding, isMobile } = state;

    const { user, roles } = useAuth();
    const canAddPost = (user && (roles?.women === "player" || roles?.women === "admin"))

    const fetchPosts = useCallback(async (isBackground = false) => {
        try{
            if (!isBackground) dispatch({ type: "SET_LOADING", payload: true });
            const ref = doc(db, "siteContent", "instagramFeedw");
            const snap = await getDoc(ref);
            if (!snap.exists()){
                dispatch({ type: "SET_ERROR", payload: "No Instagram data found." });
        return;
        }

        let postsData = snap.data().posts || [];
        if (!Array.isArray(postsData) && typeof postsData === "object")
            postsData = Object.values(postsData);

        const validUrls = postsData.filter(
            (url) => typeof url === "string" && url.startsWith("https://")
        );
        const lastFive = validUrls.slice(-5);

        const cached = JSON.stringify({ posts: lastFive, ts: Date.now() });
        localStorage.setItem("instagramFeedw", cached);

        dispatch({ type: "SET_POSTS", payload: lastFive });
        } catch (err){
        console.error("Error fetching Instagram posts:", err);
        dispatch({ type: "SET_ERROR", payload: "Failed to load Instagram feed." });
        }
    }, []);

    const handleAddPost = useCallback(async () => {
        if (!newUrl.trim().startsWith("https://")){
        alert("Please enter a valid Instagram post URL.");
        return;
        }

        dispatch({ type: "SET_ADDING", payload: true });
        try{
        const ref = doc(db, "siteContent", "instagramFeedw");
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data().posts || [] : [];

        const updated = Array.isArray(existing)
            ? [...existing, newUrl.trim()]
            : [newUrl.trim()];
        await updateDoc(ref, { posts: updated });

        dispatch({ type: "SET_NEW_URL", payload: "" });
        await fetchPosts(true);
        } catch (err){
        console.error("Error adding post:", err);
        alert("Failed to add post. Check console for details.");
        } finally{
        dispatch({ type: "SET_ADDING", payload: false });
        }
    }, [newUrl, fetchPosts]);

    useEffect(() => {
        const handleResize = () =>
        dispatch({ type: "SET_MOBILE", payload: window.innerWidth < 768 });
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const cached = JSON.parse(localStorage.getItem("instagramFeedw") || "{}");
        const cacheValid = cached.ts && Date.now() - cached.ts < (10 * 60 * 1000);

        if (cached.posts && cacheValid){
        dispatch({ type: "SET_POSTS", payload: cached.posts });
        } else{
        fetchPosts();
        }

        const interval = setInterval(() => fetchPosts(true), (5 * 60 * 1000));
        return () => clearInterval(interval);
    }, [fetchPosts]);

    useEffect(() => {
        if (!postUrls.length) return;
        const oldScript = document.querySelector(
        'script[src*="instagram.com/embed.js"]'
        );
        if (oldScript) oldScript.remove();

        const script = document.createElement("script");
        script.src = "https://www.instagram.com/embed.js";
        script.async = true;
        document.body.appendChild(script);
    }, [postUrls]);

return (
        <section className="py-10 bg-white text-center animate-fadeIn">
        {/* Add Post */}
        {canAddPost && (
            <div className="mb-6 flex justify-center gap-2">
            <input
                type="text"
                placeholder="Paste Instagram post URL..."
                value={newUrl}
                onChange={(e) =>
                dispatch({ type: "SET_NEW_URL", payload: e.target.value })
                }
                className="border border-gray-300 rounded-md px-3 py-1 w-72 text-sm"
            />
            <button
                onClick={handleAddPost}
                disabled={adding}
                className="bg-[#5E0009] text-white rounded-md px-4 py-1 text-sm hover:bg-[#7A0010] disabled:opacity-50"
            >
                {adding ? "Adding..." : "Add"}
            </button>
            </div>
        )}

        {loading && (
            <p className="text-gray-600 italic animate-pulse">Loading posts...</p>
        )}
        {error && <p className="text-red-600 italic">{error}</p>}

        {!loading && !error && (
            <>
            {isMobile ? (
                <div className="px-4">
                {postUrls.length === 0 ? (
                    <p className="text-gray-500 italic">
                    No Instagram posts to display yet.
                    </p>
                ) : (
                    <Swiper
                    modules={[Pagination, A11y]}
                    pagination={{ clickable: true }}
                    spaceBetween={15}
                    slidesPerView={1.05}
                    centeredSlides
                    grabCursor
                    resistanceRatio={0.75}
                    className="max-w-[380px] mx-auto"
                    >
                    {postUrls.map((url, i) => (
                        <SwiperSlide key={i}>
                        <blockquote
                            className="instagram-media"
                            data-instgrm-permalink={url}
                            data-instgrm-version="14"
                            style={{
                            background: "#FFF",
                            border: 0,
                            margin: "auto",
                            maxWidth: "350px",
                            width: "100%",
                            minWidth: "280px",
                            borderRadius: "10px",
                            }}
                        ></blockquote>
                        </SwiperSlide>
                    ))}
                    </Swiper>
                )}
                </div>
            ) : (
                <div className="flex flex-wrap justify-center gap-4 px-6">
                {postUrls.length === 0 ? (
                    <p className="text-gray-500 italic">
                    No Instagram posts to display yet.
                    </p>
                ) : (
                    postUrls.slice(0, 5).map((url, i) => (
                    <blockquote
                        key={i}
                        className="instagram-media"
                        data-instgrm-permalink={url}
                        data-instgrm-version="14"
                        style={{
                        background: "#FFF",
                        border: 0,
                        margin: "0",
                        maxWidth: "350px",
                        width: "100%",
                        minWidth: "280px",
                        borderRadius: "10px",
                        }}
                    ></blockquote>
                    ))
                )}
                </div>
            )}
            </>
        )}
        </section>
    );
}