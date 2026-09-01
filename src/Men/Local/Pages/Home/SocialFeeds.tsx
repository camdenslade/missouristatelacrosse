import { useEffect, useReducer, useCallback } from "react";
import { Pagination, A11y } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { apiRequest } from "../../../../Services/API";
import type { ApiInstagramFeed } from "../../../../types/api";

import "swiper/css";
import "swiper/css/pagination";

type FeedState = {
  postUrls: string[];
  loading: boolean;
  error: string;
  isMobile: boolean;
};

type FeedAction =
  | { type: "SET_POSTS"; payload: string[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_MOBILE"; payload: boolean };

const initialState: FeedState = {
  postUrls: [],
  loading: true,
  error: "",
  isMobile: window.innerWidth < 768,
};

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "SET_POSTS":
      return { ...state, postUrls: action.payload, loading: false, error: "" };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_MOBILE":
      return { ...state, isMobile: action.payload };
    default:
      return state;
  }
}

export default function SocialFeeds(){
    const [state, dispatch] = useReducer(feedReducer, initialState);
    const { postUrls, loading, error, isMobile } = state;

    const fetchPosts = useCallback(async (isBackground = false) => {
        try{
            if (!isBackground) dispatch({ type: "SET_LOADING", payload: true });
            const snap = await apiRequest<ApiInstagramFeed>("/api/site-content/instagramFeed");
            if (!snap?.data){
                dispatch({ type: "SET_ERROR", payload: "No Instagram data found." });
        return;
        }

        let postsData = snap.data.posts || [];
        if (!Array.isArray(postsData) && typeof postsData === "object")
            postsData = Object.values(postsData);

        const validUrls = postsData.filter(
            (url): url is string => typeof url === "string" && url.startsWith("https://")
        );
        const lastFive = validUrls.slice(-5);

        const cached = JSON.stringify({ posts: lastFive, ts: Date.now() });
        localStorage.setItem("instagramFeed", cached);

        dispatch({ type: "SET_POSTS", payload: lastFive });
        } catch (err){
        console.error("Error fetching Instagram posts:", err);
        dispatch({ type: "SET_ERROR", payload: "Failed to load Instagram feed." });
        }
    }, []);

    useEffect(() => {
        const handleResize = () =>
        dispatch({ type: "SET_MOBILE", payload: window.innerWidth < 768 });
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const cached: { posts?: string[]; ts?: number } =
          JSON.parse(localStorage.getItem("instagramFeed") || "{}");
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

        // Instagram's own embed request for a given post can silently fail (rate
        // limit, transient network blip) with nothing for us to catch, leaving that
        // one blockquote stuck un-rendered while its neighbors load fine. process()
        // only touches blockquotes that haven't rendered yet, so retrying it a few
        // times catches posts that failed on the first pass without re-processing
        // ones that already succeeded.
        const retryTimers: ReturnType<typeof setTimeout>[] = [];
        const scheduleRetries = () => {
        [2000, 5000, 10000].forEach((delay) => {
            retryTimers.push(
            setTimeout(() => window.instgrm?.Embeds?.process?.(), delay)
            );
        });
        };

        const script = document.createElement("script");
        script.src = "https://www.instagram.com/embed.js";
        script.async = true;
        script.onload = scheduleRetries;
        document.body.appendChild(script);

        return () => retryTimers.forEach(clearTimeout);
    }, [postUrls]);

const EmbedFrame = ({ url }: { url: string }) => (
    <div className="instagram-embed-frame relative w-full max-w-[350px] h-[560px] mx-auto overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
        <div className="absolute inset-0 flex items-center justify-center z-0">
            <div className="w-10 h-10 border-[3px] border-[#5E0009] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <blockquote
            className="instagram-media relative z-10"
            data-instgrm-permalink={url}
            data-instgrm-version="14"
            style={{ background: "transparent", border: 0, margin: 0, width: "100%", height: "100%" }}
        ></blockquote>
    </div>
);

return (
        <section className="py-16 bg-gray-50 text-center animate-fadeIn">
        <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
            <span className="h-px w-6 bg-[#5E0009]/40" />
            Follow Along
            <span className="h-px w-6 bg-[#5E0009]/40" />
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-8">From Instagram</h2>

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
                        <EmbedFrame url={url} />
                        </SwiperSlide>
                    ))}
                    </Swiper>
                )}
                </div>
            ) : (
                <div className="flex flex-wrap justify-center gap-6 px-6">
                {postUrls.length === 0 ? (
                    <p className="text-gray-500 italic">
                    No Instagram posts to display yet.
                    </p>
                ) : (
                    postUrls.slice(0, 5).map((url, i) => <EmbedFrame key={i} url={url} />)
                )}
                </div>
            )}
            </>
        )}
        </section>
    );
}
