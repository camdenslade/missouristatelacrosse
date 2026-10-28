import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { SIZE_CATEGORIES, type SavedSizes } from "../../../../../Global/Common/utils/sizeCategories";
import { apiRequest } from "../../../../../Services/API";

// Saved sizes are learned from every order and pre-fill the next order form; players can
// also set or correct them here.
export default function MySizes({ playerId, refreshKey = 0 }: { playerId: string; refreshKey?: number }) {
  const [sizes, setSizes] = useState<SavedSizes>({});
  const [draft, setDraft] = useState<SavedSizes>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<SavedSizes>(`/api/order-forms/sizes?playerId=${playerId}`)
      .then((s) => setSizes(s || {}))
      .catch(() => setSizes({}));
  }, [playerId, refreshKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await apiRequest<SavedSizes>(`/api/order-forms/sizes?playerId=${playerId}`, {
        method: "PUT",
        json: draft,
      });
      setSizes(saved || {});
      setEditing(false);
      toast.success("Sizes saved.");
    } catch {
      toast.error("Failed to save sizes.");
    } finally {
      setSaving(false);
    }
  };

  const filled = SIZE_CATEGORIES.filter((c) => sizes[c.id]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold uppercase text-gray-900">My Sizes</h3>
          <p className="text-xs text-gray-500">Saved from your orders and filled in for you on the next one.</p>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setDraft(sizes);
              setEditing(true);
            }}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009] transition"
          >
            {filled.length ? "Edit" : "Add sizes"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          {SIZE_CATEGORIES.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-xs font-semibold uppercase tracking-wide text-gray-500">{c.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {c.options.map((opt) => {
                  const active = draft[c.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, [c.id]: active ? "" : opt }))}
                      className={`min-w-[2.5rem] px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        active
                          ? "bg-[#5E0009] border-[#5E0009] text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-[#5E0009]/50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Sizes"}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      ) : filled.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filled.map((c) => (
            <span key={c.id} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              {c.label}: <span className="font-bold text-gray-900">{sizes[c.id]}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-400">No sizes saved yet. They'll be saved when you place an order.</p>
      )}
    </div>
  );
}
