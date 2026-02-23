// src/Men/Local/Pages/Schedule/Modals/Score.tsx
import { useReducer, useEffect } from "react";
import { validateNumber, validateText } from "../../../../../Global/Common/utils/validation";
import type { PlayerStat, BoxScore, ScheduleGame } from "../../../../../types/schedule";

type BoxScoreForm = Record<string, { home: string; away: string }>;

type Tab = "score" | "boxScore" | "playerStats";

type RosterPlayer = {
  name: string;
  number?: string | number | null;
  position?: string | null;
};

type State = {
  msuScore: string;
  oppScore: string;
  notes: string;
  saving: boolean;
  error: string;
  activeTab: Tab;
  boxScore: BoxScoreForm;
  showOT: boolean;
  playerStats: PlayerStat[];
};

type Action =
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "LOAD_GAME"; game: ScheduleGame; players: RosterPlayer[] }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_TAB"; tab: Tab }
  | { type: "SET_BOX_SCORE"; quarter: string; side: "home" | "away"; value: string }
  | { type: "TOGGLE_OT" }
  | { type: "UPDATE_PLAYER"; index: number; field: string; value: string | number | boolean }
  | { type: "TOGGLE_GOALIE"; index: number };

const defaultBoxScore = (): BoxScoreForm => ({
  Q1: { home: "", away: "" },
  Q2: { home: "", away: "" },
  Q3: { home: "", away: "" },
  Q4: { home: "", away: "" },
});

const initialState: State = {
  msuScore: "",
  oppScore: "",
  notes: "",
  saving: false,
  error: "",
  activeTab: "score",
  boxScore: defaultBoxScore(),
  showOT: false,
  playerStats: [],
};

function loadBoxScore(bs: BoxScore | null | undefined): { form: BoxScoreForm; hasOT: boolean } {
  if (!bs) return { form: defaultBoxScore(), hasOT: false };
  const form: BoxScoreForm = defaultBoxScore();
  let hasOT = false;
  for (const [q, entry] of Object.entries(bs)) {
    if (q === "OT") hasOT = true;
    form[q] = {
      home: entry?.home != null ? String(entry.home) : "",
      away: entry?.away != null ? String(entry.away) : "",
    };
  }
  return { form, hasOT };
}

function isGoaliePosition(position?: string | null): boolean {
  if (!position) return false;
  const p = position.toLowerCase().trim();
  return p === "g" || p === "goalie";
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "LOAD_GAME": {
      const g = action.game;
      const { form, hasOT } = loadBoxScore(g.boxScore);
      const existingStats: PlayerStat[] = Array.isArray(g.stats) ? g.stats : [];

      // Build playerStats from roster, merging any existing game stats
      const playerStats: PlayerStat[] = action.players.map((p) => {
        const existing = existingStats.find(
          (s) => s.name?.toLowerCase() === p.name?.toLowerCase()
        );
        const goalie = existing?.isGoalie ?? isGoaliePosition(p.position);
        if (existing) {
          return { ...existing, isGoalie: goalie, number: p.number ?? existing.number };
        }
        return { name: p.name, number: p.number, isGoalie: goalie };
      });

      return {
        ...state,
        msuScore: g.msuScore != null ? String(g.msuScore) : "",
        oppScore: g.oppScore != null ? String(g.oppScore) : "",
        notes: g.notes ?? "",
        boxScore: form,
        showOT: hasOT,
        playerStats,
        error: "",
      };
    }
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_BOX_SCORE": {
      const bs = { ...state.boxScore };
      bs[action.quarter] = { ...bs[action.quarter], [action.side]: action.value };
      return { ...state, boxScore: bs };
    }
    case "TOGGLE_OT": {
      const bs = { ...state.boxScore };
      if (state.showOT) {
        delete bs.OT;
      } else {
        bs.OT = { home: "", away: "" };
      }
      return { ...state, boxScore: bs, showOT: !state.showOT };
    }
    case "UPDATE_PLAYER": {
      const ps = [...state.playerStats];
      ps[action.index] = { ...ps[action.index], [action.field]: action.value };
      return { ...state, playerStats: ps };
    }
    case "TOGGLE_GOALIE": {
      const ps = [...state.playerStats];
      const cur = ps[action.index];
      ps[action.index] = {
        name: cur.name,
        isGoalie: !cur.isGoalie,
      };
      return { ...state, playerStats: ps };
    }
    default:
      return state;
  }
}

const inputClass =
  "w-full border border-gray-300 rounded px-1 py-0.5 text-center text-xs focus:ring-1 focus:ring-[#5E0009] focus:outline-none";

const TABS: { key: Tab; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "boxScore", label: "Box Score" },
  { key: "playerStats", label: "Player Stats" },
];

const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4", "OT"];

export default function ScoreModal({
  isOpen,
  onClose,
  game,
  onSave,
  players = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  game: ScheduleGame | null;
  onSave: (updated: ScheduleGame) => Promise<void>;
  players?: RosterPlayer[];
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { msuScore, oppScore, notes, saving, error, activeTab, boxScore, showOT, playerStats } =
    state;

  useEffect(() => {
    if (game) dispatch({ type: "LOAD_GAME", game, players });
  }, [game]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });

    const validationError =
      validateNumber(msuScore, "Missouri State score", { required: true, min: 0, max: 99 }) ||
      validateNumber(oppScore, "Opponent score", { required: true, min: 0, max: 99 }) ||
      validateText(notes, "Notes", { required: false, max: 300 });
    if (validationError) {
      dispatch({ type: "SET_ERROR", error: validationError });
      return;
    }

    const result =
      Number(msuScore) > Number(oppScore)
        ? "W"
        : Number(msuScore) < Number(oppScore)
          ? "L"
          : "T";

    // Clean box score
    const cleanBoxScore: BoxScore = {};
    for (const [q, val] of Object.entries(boxScore)) {
      const h = val.home !== "" ? Number(val.home) : undefined;
      const a = val.away !== "" ? Number(val.away) : undefined;
      if (h !== undefined || a !== undefined) {
        cleanBoxScore[q] = { home: h, away: a };
      }
    }

    // Clean player stats — only include players with at least one stat
    const cleanStats: PlayerStat[] = playerStats
      .filter((s) => s.name?.trim())
      .map((s) => {
        const clean: PlayerStat = { name: s.name?.trim(), number: s.number, isGoalie: !!s.isGoalie };
        if (s.isGoalie) {
          if (s.gamesPlayed) clean.gamesPlayed = Number(s.gamesPlayed);
          if (s.gamesStarted) clean.gamesStarted = Number(s.gamesStarted);
          if (s.saves) clean.saves = Number(s.saves);
          if (s.goalsAllowed) clean.goalsAllowed = Number(s.goalsAllowed);
        } else {
          if (s.gamesPlayed) clean.gamesPlayed = Number(s.gamesPlayed);
          if (s.gamesStarted) clean.gamesStarted = Number(s.gamesStarted);
          if (s.goals) clean.goals = Number(s.goals);
          if (s.assists) clean.assists = Number(s.assists);
          if (s.shotsOnGoal) clean.shotsOnGoal = Number(s.shotsOnGoal);
          if (s.groundBalls) clean.groundBalls = Number(s.groundBalls);
          if (s.causedTurnovers) clean.causedTurnovers = Number(s.causedTurnovers);
          if (s.faceoffWins) clean.faceoffWins = Number(s.faceoffWins);
          if (s.faceoffLosses) clean.faceoffLosses = Number(s.faceoffLosses);
        }
        return clean;
      })
      .filter((s) => {
        if (s.isGoalie) return s.gamesPlayed || s.saves || s.goalsAllowed;
        return (
          s.gamesPlayed || s.goals || s.assists || s.shotsOnGoal || s.groundBalls ||
          s.causedTurnovers || s.faceoffWins || s.faceoffLosses
        );
      });

    try {
      dispatch({ type: "SET_SAVING", value: true });
      await onSave({
        ...(game as ScheduleGame),
        msuScore: Number(msuScore),
        oppScore: Number(oppScore),
        result,
        notes,
        boxScore: Object.keys(cleanBoxScore).length ? cleanBoxScore : undefined,
        stats: cleanStats.length ? cleanStats : undefined,
      });
    } catch (err) {
      console.error("Error saving game score:", err);
      dispatch({ type: "SET_ERROR", error: "Failed to save score. Please try again." });
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  };

  const updatePlayer = (index: number, field: string, value: string) => {
    dispatch({ type: "UPDATE_PLAYER", index, field, value });
  };

  const sortedQuarters = Object.keys(boxScore).sort(
    (a, b) => QUARTER_ORDER.indexOf(a) - QUARTER_ORDER.indexOf(b)
  );

  const fieldRows = playerStats
    .map((stat, index) => ({ stat, index }))
    .filter(({ stat }) => !stat.isGoalie);

  const goalieRows = playerStats
    .map((stat, index) => ({ stat, index }))
    .filter(({ stat }) => stat.isGoalie);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl animate-fadeIn flex flex-col max-h-[85vh]">
        <div className="p-6 pb-0">
          <h2 className="text-2xl font-bold mb-4 text-center text-[#5E0009]">
            Enter Game Score
          </h2>

          {/* Tabs */}
          <div className="flex border-b">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => dispatch({ type: "SET_TAB", tab: tab.key })}
                className={`px-4 py-2 font-semibold text-sm transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-[#5E0009] text-[#5E0009]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 pt-4 overflow-y-auto flex-1">
            {/* Score Tab */}
            {activeTab === "score" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-1">Missouri State Score</label>
                  <input
                    type="number"
                    value={msuScore}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "msuScore", value: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Opponent Score</label>
                  <input
                    type="number"
                    value={oppScore}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "oppScore", value: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Notes / Recap Link (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "notes", value: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Box Score Tab */}
            {activeTab === "boxScore" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase">
                  <span />
                  <span className="text-center">MSU</span>
                  <span className="text-center">
                    {game?.opponent ? game.opponent.slice(0, 3).toUpperCase() : "OPP"}
                  </span>
                </div>
                {sortedQuarters.map((quarter) => (
                  <div key={quarter} className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-semibold text-gray-800">{quarter}</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={boxScore[quarter]?.home ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_BOX_SCORE",
                          quarter,
                          side: "home",
                          value: e.target.value,
                        })
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-center focus:ring-1 focus:ring-[#5E0009] focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={boxScore[quarter]?.away ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_BOX_SCORE",
                          quarter,
                          side: "away",
                          value: e.target.value,
                        })
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-center focus:ring-1 focus:ring-[#5E0009] focus:outline-none"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => dispatch({ type: "TOGGLE_OT" })}
                  className="text-sm text-[#5E0009] hover:underline mt-1"
                >
                  {showOT ? "Remove Overtime" : "+ Add Overtime"}
                </button>
              </div>
            )}

            {/* Player Stats Tab */}
            {activeTab === "playerStats" && (
              <div className="space-y-4">
                {playerStats.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No roster players found for this season.
                  </p>
                ) : (
                  <>
                    {/* Field Players */}
                    {fieldRows.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Field Players</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse min-w-[580px]">
                            <thead>
                              <tr className="border-b font-semibold bg-gray-200">
                                <th className="p-1 text-left">Player</th>
                                <th className="p-1 text-center">GP</th>
                                <th className="p-1 text-center">GS</th>
                                <th className="p-1 text-center">G</th>
                                <th className="p-1 text-center">A</th>
                                <th className="p-1 text-center">SH</th>
                                <th className="p-1 text-center">GB</th>
                                <th className="p-1 text-center">CT</th>
                                <th className="p-1 text-center">FOW</th>
                                <th className="p-1 text-center">FOL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fieldRows.map(({ stat, index }) => (
                                <tr key={index} className="border-b">
                                  <td className="p-1 font-medium whitespace-nowrap">
                                    {stat.name}
                                  </td>
                                  <td className="p-1 text-center">
                                    <input type="checkbox" checked={!!stat.gamesPlayed} onChange={(e) => dispatch({ type: "UPDATE_PLAYER", index, field: "gamesPlayed", value: e.target.checked ? 1 : 0 })} />
                                  </td>
                                  <td className="p-1 text-center">
                                    <input type="checkbox" checked={!!stat.gamesStarted} onChange={(e) => dispatch({ type: "UPDATE_PLAYER", index, field: "gamesStarted", value: e.target.checked ? 1 : 0 })} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.goals ?? ""} onChange={(e) => updatePlayer(index, "goals", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.assists ?? ""} onChange={(e) => updatePlayer(index, "assists", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.shotsOnGoal ?? ""} onChange={(e) => updatePlayer(index, "shotsOnGoal", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.groundBalls ?? ""} onChange={(e) => updatePlayer(index, "groundBalls", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.causedTurnovers ?? ""} onChange={(e) => updatePlayer(index, "causedTurnovers", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.faceoffWins ?? ""} onChange={(e) => updatePlayer(index, "faceoffWins", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.faceoffLosses ?? ""} onChange={(e) => updatePlayer(index, "faceoffLosses", e.target.value)} className={inputClass} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Goalies */}
                    {goalieRows.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Goalies</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b font-semibold bg-gray-200">
                                <th className="p-1 text-left">Player</th>
                                <th className="p-1 text-center">GP</th>
                                <th className="p-1 text-center">GS</th>
                                <th className="p-1 text-center">S</th>
                                <th className="p-1 text-center">GA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {goalieRows.map(({ stat, index }) => (
                                <tr key={index} className="border-b">
                                  <td className="p-1 font-medium whitespace-nowrap">
                                    {stat.name}
                                  </td>
                                  <td className="p-1 text-center">
                                    <input type="checkbox" checked={!!stat.gamesPlayed} onChange={(e) => dispatch({ type: "UPDATE_PLAYER", index, field: "gamesPlayed", value: e.target.checked ? 1 : 0 })} />
                                  </td>
                                  <td className="p-1 text-center">
                                    <input type="checkbox" checked={!!stat.gamesStarted} onChange={(e) => dispatch({ type: "UPDATE_PLAYER", index, field: "gamesStarted", value: e.target.checked ? 1 : 0 })} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.saves ?? ""} onChange={(e) => updatePlayer(index, "saves", e.target.value)} className={inputClass} />
                                  </td>
                                  <td className="p-1">
                                    <input type="number" min="0" value={stat.goalsAllowed ?? ""} onChange={(e) => updatePlayer(index, "goalsAllowed", e.target.value)} className={inputClass} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-0">
            {error && (
              <p className="text-red-600 text-sm text-center font-medium mb-3">{error}</p>
            )}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#5E0009] text-white hover:bg-red-800 rounded transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
