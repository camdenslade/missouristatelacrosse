import { useState } from "react";
import toast from "react-hot-toast";

import { apiRequest } from "../../../Services/API";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4", "OT"];

type BoxScoreMap = Record<string, { home?: number; away?: number }>;

type Props = {
  gameId: string;
  program: string;
  opponent: string;
  msuScore: number;
  oppScore: number;
  boxScore: BoxScoreMap;
  currentQuarter: string;
  timeInQuarter: string;
  canEditStats: boolean;
  stats: any[];
  onSaved: (data: Record<string, unknown>) => void;
};

/**
 * A pared-down score/box-score editor for anyone with score-edit access (player/parent/
 * alumni and up) - not the full admin game-management UI, just enough to keep a live
 * score current. Player stats only show up here for whoever the admin assigned to enter
 * them (or an admin); the backend enforces that regardless of what this form sends.
 */
export default function LiveScoreEditor({
  gameId, program, opponent, msuScore, oppScore, boxScore,
  currentQuarter, timeInQuarter, canEditStats, stats, onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    msuScore: String(msuScore ?? 0),
    oppScore: String(oppScore ?? 0),
    boxScore: boxScore || {},
    currentQuarter: currentQuarter || "Q1",
    timeInQuarter: timeInQuarter || "15:00",
    stats: stats || [],
  });

  const setBox = (q: string, side: "home" | "away", value: string) => {
    setForm((f) => ({
      ...f,
      boxScore: { ...f.boxScore, [q]: { ...f.boxScore[q], [side]: value === "" ? undefined : Number(value) } },
    }));
  };

  const setStat = (index: number, field: string, value: string) => {
    setForm((f) => {
      const next = [...f.stats];
      next[index] = { ...next[index], [field]: value === "" ? undefined : Number(value) };
      return { ...f, stats: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        msuScore: Number(form.msuScore) || 0,
        oppScore: Number(form.oppScore) || 0,
        boxScore: form.boxScore,
        currentQuarter: form.currentQuarter,
        timeInQuarter: form.timeInQuarter,
      };
      if (canEditStats) data.stats = form.stats;

      const updated = await apiRequest<{ data: string }>(`/api/games/${gameId}`, {
        method: "PUT",
        json: { data },
      });
      const parsed = typeof updated.data === "string" ? JSON.parse(updated.data) : updated.data;
      onSaved(parsed);
      toast.success("Score updated!");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update score.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-[#5E0009] hover:underline"
      >
        Update Score
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-2 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-800">Update Score</h4>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">
          Close
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">MSU</label>
          <input
            type="number"
            value={form.msuScore}
            onChange={(e) => setForm((f) => ({ ...f, msuScore: e.target.value }))}
            className="w-16 border border-gray-200 rounded px-2 py-1 text-center text-sm"
          />
        </div>
        <div className="pb-1 text-gray-400">-</div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{opponent || "Opp"}</label>
          <input
            type="number"
            value={form.oppScore}
            onChange={(e) => setForm((f) => ({ ...f, oppScore: e.target.value }))}
            className="w-16 border border-gray-200 rounded px-2 py-1 text-center text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Quarter</label>
          <select
            value={form.currentQuarter}
            onChange={(e) => setForm((f) => ({ ...f, currentQuarter: e.target.value }))}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm w-20"
          >
            {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Time</label>
          <input
            type="text"
            value={form.timeInQuarter}
            onChange={(e) => setForm((f) => ({ ...f, timeInQuarter: e.target.value }))}
            placeholder="15:00"
            className="w-20 border border-gray-200 rounded px-2 py-1.5 text-sm text-center"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Box Score</label>
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th style={{ width: "3.5rem" }} />
              {QUARTERS.map((q) => <th key={q} className="px-1 text-gray-400 font-bold">{q}</th>)}
            </tr>
          </thead>
          <tbody>
            {(["home", "away"] as const).map((side) => (
              <tr key={side}>
                <td className="pr-2 font-bold text-gray-700">{side === "home" ? "MSU" : "Opp"}</td>
                {QUARTERS.map((q) => (
                  <td key={q} className="px-1 py-0.5">
                    <input
                      type="number"
                      value={form.boxScore[q]?.[side] ?? ""}
                      onChange={(e) => setBox(q, side, e.target.value)}
                      className="w-10 border border-gray-200 rounded px-1 py-0.5 text-center"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEditStats && form.stats.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Player Stats (you're assigned to enter these)
          </label>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-[#5E0009] text-white">
                  <th className="p-1.5 text-left">Player</th>
                  <th className="p-1.5">G</th>
                  <th className="p-1.5">A</th>
                  <th className="p-1.5">SH</th>
                  <th className="p-1.5">GB</th>
                  <th className="p-1.5">S</th>
                  <th className="p-1.5">GA</th>
                </tr>
              </thead>
              <tbody>
                {form.stats.map((s: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-1.5 font-medium">{s.name}</td>
                    {s.isGoalie ? (
                      <>
                        <td colSpan={4} />
                        <td className="p-1"><input type="number" value={s.saves ?? ""} onChange={(e) => setStat(i, "saves", e.target.value)} className="w-10 border border-gray-200 rounded px-1 text-center" /></td>
                        <td className="p-1"><input type="number" value={s.goalsAllowed ?? ""} onChange={(e) => setStat(i, "goalsAllowed", e.target.value)} className="w-10 border border-gray-200 rounded px-1 text-center" /></td>
                      </>
                    ) : (
                      <>
                        <td className="p-1"><input type="number" value={s.goals ?? ""} onChange={(e) => setStat(i, "goals", e.target.value)} className="w-10 border border-gray-200 rounded px-1 text-center" /></td>
                        <td className="p-1"><input type="number" value={s.assists ?? ""} onChange={(e) => setStat(i, "assists", e.target.value)} className="w-10 border border-gray-200 rounded px-1 text-center" /></td>
                        <td className="p-1"><input type="number" value={s.shotsOnGoal ?? ""} onChange={(e) => setStat(i, "shotsOnGoal", e.target.value)} className="w-10 border border-gray-200 rounded px-1 text-center" /></td>
                        <td className="p-1"><input type="number" value={s.groundBalls ?? ""} onChange={(e) => setStat(i, "groundBalls", e.target.value)} className="w-10 border border-gray-200 rounded px-1 text-center" /></td>
                        <td colSpan={2} />
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-semibold hover:bg-[#7a0012] transition disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
