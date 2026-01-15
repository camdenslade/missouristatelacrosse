// src/Women/Local/Pages/Payments/components/PlayerTable.jsx
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
      await apiRequest(`/api/players/${p.id}`, {
        method: "PUT",
        json: { balance: Number(p.balance || 0) },
      });

      const cached = JSON.parse(localStorage.getItem("playerswCache") || "{}");
      if (cached.list) {
        const updatedList = cached.list.map((pl: ApiPlayer) =>
          pl.id === p.id ? { ...pl, balance: Number(p.balance || 0) } : pl
        );
        localStorage.setItem(
          "playerswCache",
          JSON.stringify({ ...cached, list: updatedList })
        );
      }

      setMessage(`Balance updated for ${p.name || "player"}.`);
    } catch {
      setMessage("Failed to update balance.");
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  return (
    <div className="mb-6 animate-fadeIn">
      <h2 className="text-xl font-semibold mb-3">All Players</h2>

      {message && (
        <div className="mb-3 text-center text-sm font-medium text-gray-700">
          {message}
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-2 text-left">Name</th>
              <th className="border px-2 py-2 text-left">Email</th>
              <th className="border px-2 py-2 text-left">Balance</th>
              <th className="border px-2 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-gray-50 transition"
                onClick={() => onSelectedPlayer?.(p)}
              >
                <td className="border px-2 py-2">{p.name || "N/A"}</td>
                <td className="border px-2 py-2 text-sm text-gray-700">
                  {userEmails[p.id] || p.email || "N/A"}
                </td>
                <td className="border px-2 py-2">
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
                    className="border px-2 py-1 w-24 rounded text-center focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
                  />
                </td>
                <td className="border px-2 py-2">
                  <button
                    onClick={() => handleSave(p)}
                    disabled={saving === p.id}
                    className={`px-3 py-1 rounded text-white transition ${
                      saving === p.id
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
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
  );
}
