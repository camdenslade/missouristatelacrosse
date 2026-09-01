import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { apiRequest } from "../../../../../Services/API";
import type { ApiPlayer } from "../../../../../types/api";

type PlayerTableProps = {
  players: ApiPlayer[];
  setPlayers: Dispatch<SetStateAction<ApiPlayer[]>>;
  userEmails: Record<string, string>;
  onSelectedPlayer?: (player: ApiPlayer) => void;
};

export default function PlayerTable({
  players,
  setPlayers,
  userEmails,
  onSelectedPlayer,
}: PlayerTableProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const handleSave = async (p: ApiPlayer) => {
    setSaving(p.id);
    setMessage("");
    try {
      const email = (p.email ?? "").trim();
      await apiRequest(`/api/players/${p.id}`, {
        method: "PUT",
        json: { balance: Number(p.balance || 0), email: email || undefined },
      });

      const cached = JSON.parse(localStorage.getItem("playerswCache") || "{}");
      if (cached.list) {
        const updatedList = cached.list.map((pl: ApiPlayer) =>
          pl.id === p.id ? { ...pl, balance: Number(p.balance || 0), email } : pl
        );
        localStorage.setItem(
          "playerswCache",
          JSON.stringify({ ...cached, list: updatedList })
        );
      }

      setMessage(`Updated ${p.name || "player"}.`);
    } catch {
      setMessage("Failed to save changes.");
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  const updateField = (id: string, field: "email" | "balance", value: string | number) => {
    setPlayers((prev) => prev.map((pl) => (pl.id === id ? { ...pl, [field]: value } : pl)));
  };

  return (
    <div className="animate-fadeIn">
      <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
        <span className="h-px w-6 bg-[#5E0009]/40" />
        Roster
        <span className="h-px w-6 bg-[#5E0009]/40" />
      </div>

      {message && (
        <div className="mb-3 text-center text-sm font-medium text-gray-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Balance</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {players.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onSelectedPlayer?.(p)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name || "N/A"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="email"
                      placeholder="No email on file"
                      value={p.email ?? userEmails[p.id] ?? ""}
                      onChange={(e) => updateField(p.id, "email", e.target.value)}
                      className="border border-gray-200 px-3 py-1.5 w-full rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={p.balance ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const value = raw === "" ? "" : Number(raw);
                        setPlayers((prev) =>
                          prev.map((pl) =>
                            pl.id === p.id
                              ? {
                                  ...pl,
                                  balance:
                                    typeof value === "number" && Number.isFinite(value)
                                      ? value
                                      : "",
                                }
                              : pl
                          )
                        );
                      }}
                      className="border border-gray-200 px-3 py-1.5 w-24 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSave(p)}
                      disabled={saving === p.id}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white transition ${
                        saving === p.id
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-[#5E0009] hover:bg-[#7a0012]"
                      }`}
                    >
                      {saving === p.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
