import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import API_BASE from "../../../Services/API";

interface StreamPlayerProps {
  signedUrl: string | null;
  sessionToken: string | null;
  gameId: string;
  program: string;
  onSessionExpired: () => void;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const AUTO_RETRY_DELAY_MS = 20_000;
const BASE_URL = `${(API_BASE || "").replace(/\/+$/, "")}/api/stream`;
const MAX_FATAL_RETRIES = 3;

export default function StreamPlayer({
  signedUrl,
  sessionToken,
  gameId,
  program,
  onSessionExpired,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const urlRef = useRef<string | null>(signedUrl);
  const retryCountRef = useRef(0);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [initKey, setInitKey] = useState(0);

  const triggerRetry = () => {
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    setStreamError(false);
    retryCountRef.current = 0;
    setInitKey((k) => k + 1);
  };

  // Load HLS stream via hls.js (Chrome/Firefox) or native (Safari)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !signedUrl) return;

    setStreamError(false);
    retryCountRef.current = 0;
    urlRef.current = signedUrl;

    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        liveSyncDurationCount: 3,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferHole: 0.5,
        lowLatencyMode: false,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000,
      });
      hlsRef.current = hls;
      hls.loadSource(signedUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      // Reset error counter whenever a fragment loads successfully so transient
      // network blips don't permanently consume retry budget.
      hls.on(Hls.Events.FRAG_LOADED, () => {
        retryCountRef.current = 0;
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (retryCountRef.current < MAX_FATAL_RETRIES) {
          retryCountRef.current++;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
            hlsRef.current = null;
            setStreamError(true);
            autoRetryTimerRef.current = setTimeout(triggerRetry, AUTO_RETRY_DELAY_MS);
          }
        } else {
          hls.destroy();
          hlsRef.current = null;
          setStreamError(true);
          autoRetryTimerRef.current = setTimeout(triggerRetry, AUTO_RETRY_DELAY_MS);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = signedUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [signedUrl, initKey]);

  // Auto-recover when the user returns to the tab or their network comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (streamError) {
        triggerRetry();
      } else if (hlsRef.current) {
        // Tab was backgrounded — prod the loader in case it stalled
        hlsRef.current.startLoad();
      }
    };
    const handleOnline = () => triggerRetry();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [streamError]);

  // Heartbeat / token refresh
  useEffect(() => {
    if (!sessionToken) return;

    const tick = async () => {
      try {
        const res = await fetch(`${BASE_URL}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Program": program },
          body: JSON.stringify({ sessionToken, gameId }),
        });

        if (res.status === 410) {
          onSessionExpired();
          return;
        }
        if (!res.ok) return;

        const data = await res.json();
        if (data.signedUrl && data.signedUrl !== urlRef.current) {
          urlRef.current = data.signedUrl;
          if (hlsRef.current) {
            hlsRef.current.loadSource(data.signedUrl);
          } else if (videoRef.current) {
            videoRef.current.src = data.signedUrl;
          }
        }
      } catch {
        // retry next tick
      }
    };

    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sessionToken, gameId, program, onSessionExpired]);

  // Session cleanup — sendBeacon only supports POST, so use /session/disconnect
  useEffect(() => {
    if (!sessionToken) return;
    const onUnload = () => {
      navigator.sendBeacon(
        `${BASE_URL}/session/disconnect`,
        new Blob([JSON.stringify({ sessionToken })], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [sessionToken]);

  if (streamError) {
    return (
      <div
        className="w-full rounded-lg bg-black flex items-center justify-center"
        style={{ minHeight: "200px", maxHeight: "480px" }}
      >
        <div className="text-center text-white p-6">
          <p className="text-lg font-semibold mb-1">Stream Unavailable</p>
          <p className="text-sm text-gray-400 mb-4">
            Reconnecting automatically&hellip;
          </p>
          <button
            onClick={triggerRetry}
            className="px-4 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800 text-sm"
          >
            Retry Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      className="w-full rounded-lg bg-black"
      style={{ maxHeight: "480px" }}
    />
  );
}
