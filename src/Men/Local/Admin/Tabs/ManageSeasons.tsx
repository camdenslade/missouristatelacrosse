import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { apiRequest } from "../../../../Services/API";

type SeasonResponse = {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  sortOrder: number;
};

export default function ManageSeasons() {
  const [seasons, setSeasons] = useState<SeasonResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSeasons = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<SeasonResponse[]>("/api/seasons");
      setSeasons(data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load seasons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Season code is required (e.g. 26-27).");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/seasons", {
        method: "POST",
        json: { code: code.trim(), label: label.trim() || undefined },
      });
      setCode("");
      setLabel("");
      toast.success("Season added.");
      await fetchSeasons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add season.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    setBusyId(id);
    try {
      await apiRequest(`/api/seasons/${id}/activate`, { method: "POST" });
      toast.success("Active season updated.");
      await fetchSeasons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set active season.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, seasonCode: string) => {
    if (!confirm(`Delete season "${seasonCode}"? This only works if no players/games/coaches use it.`)) return;
    setBusyId(id);
    try {
      await apiRequest(`/api/seasons/${id}`, { method: "DELETE" });
      toast.success("Season deleted.");
      await fetchSeasons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete season.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage Seasons</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Control which seasons appear on Roster/Schedule and which one is active by default.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
          <input
            type="text"
            placeholder="26-27"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
          />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Label (optional)</label>
          <input
            type="text"
            placeholder="2026-2027"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0010] text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add Season"}
        </button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[#5E0009] rounded-full animate-spin" />
          Loading...
        </div>
      ) : seasons.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No seasons yet - add one above.</p>
      ) : (
        <div className="space-y-2">
          {seasons.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${
                s.active ? "border-[#5E0009] bg-red-50/30" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900">{s.code}</span>
                {s.label && <span className="text-sm text-gray-500 ml-2">{s.label}</span>}
                {s.active && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium bg-[#5E0009] text-white">
                    Active
                  </span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {!s.active && (
                  <button
                    onClick={() => handleActivate(s.id)}
                    disabled={busyId === s.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium transition disabled:opacity-50"
                  >
                    Make Active
                  </button>
                )}
                <button
                  onClick={() => handleDelete(s.id, s.code)}
                  disabled={busyId === s.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
