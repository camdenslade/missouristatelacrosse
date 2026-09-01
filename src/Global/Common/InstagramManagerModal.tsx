import { Instagram, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { apiRequest } from "../../Services/API";
import type { ApiInstagramFeed } from "../../types/api";

type InstagramManagerModalProps = {
  open: boolean;
  onClose: () => void;
  contentKey: "instagramFeed" | "instagramFeedw";
};

export default function InstagramManagerModal({ open, onClose, contentKey }: InstagramManagerModalProps) {
  const [posts, setPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const MAX_POSTS = 5;

  const savePosts = async (updated: string[]) => {
    setSaving(true);
    try {
      await apiRequest(`/api/site-content/${contentKey}`, {
        method: "PUT",
        json: { posts: updated },
      });
      setPosts(updated);
    } catch {
      toast.error("Failed to update Instagram posts.");
    } finally {
      setSaving(false);
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const snap = await apiRequest<ApiInstagramFeed>(`/api/site-content/${contentKey}`);
      const raw = snap?.data?.posts || [];
      const list = Array.isArray(raw) ? raw : Object.values(raw);
      const urls = list.filter((url): url is string => typeof url === "string");
      if (urls.length > MAX_POSTS) {
        // Self-heal any backlog from before this was capped, keeping the most recent 5.
        const trimmed = urls.slice(-MAX_POSTS);
        setPosts(trimmed);
        await savePosts(trimmed);
      } else {
        setPosts(urls);
      }
    } catch {
      toast.error("Failed to load Instagram posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadPosts();
  }, [open, contentKey]);

  const handleAdd = async () => {
    if (!newUrl.trim().startsWith("https://")) {
      toast.error("Please enter a valid Instagram post URL.");
      return;
    }
    // Keep only the 5 most recent posts - adding a 6th drops the oldest.
    const updated = [...posts, newUrl.trim()].slice(-MAX_POSTS);
    await savePosts(updated);
    setNewUrl("");
  };

  const handleRemove = async (url: string) => {
    await savePosts(posts.filter((p) => p !== url));
  };

  if (!open) return null;

  return (
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
              <h3 className="text-xl font-bold leading-tight text-white">Instagram Feed Manager</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-white hover:bg-white/15 transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <input
              placeholder="Paste Instagram post URL..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 bg-[#5E0009] text-white px-5 py-2.5 rounded-full font-semibold hover:bg-[#7a0012] transition whitespace-nowrap disabled:opacity-50"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No posts yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {posts.map((url) => (
                <div key={url} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex items-center gap-3">
                    <Instagram size={16} className="text-[#5E0009] shrink-0" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-700 hover:text-[#5E0009] text-sm truncate transition"
                    >
                      {url}
                    </a>
                  </div>
                  <button
                    onClick={() => handleRemove(url)}
                    disabled={saving}
                    aria-label="Remove post"
                    className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
