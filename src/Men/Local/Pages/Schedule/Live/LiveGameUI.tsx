// src/Men/Local/Pages/Schedule/Live/LiveGameUI.tsx
import { useReducer, useState } from "react";
import toast from "react-hot-toast";

import type { PlayerStat } from "../../../../../types/schedule";
import type { Player } from "../../../../../types/roster";
import { updateLiveGame } from "../hooks/LiveGameUpdater";
import StreamPlayer from "../../../../../Global/Common/components/StreamPlayer";
import LiveChat from "../../../../../Global/Common/components/LiveChat";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const FIELD_KEYS = [
  "goals",
  "assists",
  "shotsOnGoal",
  "groundBalls",
  "causedTurnovers",
  "turnovers",
  "faceoffWins",
  "faceoffLosses",
] as const;
type FieldStatKey = typeof FIELD_KEYS[number];

type BoxScoreForm = Record<string, { home: string; away: string }>;

type State = {
  quarter: string;
  timeInQuarter: string;
  boxScore: BoxScoreForm;
  showOT: boolean;
  stats: PlayerStat[];
  saving: boolean;
};

type Action =
  | { type: "SET_FIELD"; field: "quarter" | "timeInQuarter"; value: string }
  | { type: "SET_BOX"; quarter: string; side: "home" | "away"; value: string }
  | { type: "TOGGLE_OT" }
  | { type: "UPDATE_STAT"; index: number; field: keyof PlayerStat; value: string | number | boolean }
  | { type: "SAVE_START" | "SAVE_END" };

const inputClass =
  "w-full border border-gray-200 bg-gray-50 rounded px-1 py-0.5 text-center text-xs focus:ring-1 focus:ring-[#5E0009] focus:outline-none";

const ic =
  "w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-center text-xs focus:ring-1 focus:ring-[#5E0009] focus:outline-none";

const isGoaliePosition = (position?: string | null): boolean => {
  if (!position) return false;
  const normalized = position.toLowerCase().trim();
  return normalized === "g" || normalized === "goalie";
};

const buildBoxScoreForm = (game: Record<string, unknown>): BoxScoreForm => {
  const bs = (game.boxScore || {}) as Record<string, { home?: number; away?: number }> | null;
  const form: BoxScoreForm = {
    Q1: { home: "", away: "" },
    Q2: { home: "", away: "" },
    Q3: { home: "", away: "" },
    Q4: { home: "", away: "" },
  };
  if (bs) {
    Object.entries(bs).forEach(([quarter, values]) => {
      if (!quarter) return;
      form[quarter] = {
        home: values?.home != null ? String(values.home) : "",
        away: values?.away != null ? String(values.away) : "",
      };
    });
  }
  return form;
};

const initStats = (game: Record<string, unknown>, players: Player[]): PlayerStat[] => {
  const existing: PlayerStat[] = Array.isArray(game.stats)
    ? (game.stats as PlayerStat[])
    : Array.isArray(game.playerStats)
    ? (game.playerStats as PlayerStat[])
    : [];
  if (players.length === 0) return existing;
  const playerEntries = players
    .filter((p) => !!p.name)
    .map((player) => {
      const match = existing.find(
        (stat) => stat.name?.toLowerCase() === player.name.toLowerCase()
      );
      const goalie = match?.isGoalie ?? isGoaliePosition(player.position);
      if (match) return { ...match, isGoalie: goalie, number: player.number ?? match.number };
      return {
        name: player.name,
        number: player.number,
        isGoalie: goalie,
      };
    });
  const remaining = existing.filter(
    (stat) =>
      !playerEntries.some(
        (entry) => entry.name?.toLowerCase() === stat.name?.toLowerCase()
      )
  );
  return [...playerEntries, ...remaining];
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_BOX": {
      const updated = { ...state.boxScore };
      updated[action.quarter] = {
        ...updated[action.quarter],
        [action.side]: action.value,
      };
      return { ...state, boxScore: updated };
    }
    case "TOGGLE_OT": {
      const updated = { ...state.boxScore };
      if (state.showOT) {
        delete updated.OT;
      } else {
        updated.OT = { home: "", away: "" };
      }
      return { ...state, boxScore: updated, showOT: !state.showOT };
    }
    case "UPDATE_STAT": {
      const stats = [...state.stats];
      stats[action.index] = { ...stats[action.index], [action.field]: action.value };
      return { ...state, stats };
    }
    case "SAVE_START":
      return { ...state, saving: true };
    case "SAVE_END":
      return { ...state, saving: false };
    default:
      return state;
  }
}

export default function LiveGameUI({
  game,
  players = [],
  program = "men",
}: {
  game: Record<string, any>;
  players?: Player[];
  program?: string;
}) {
  const [showStream, setShowStream] = useState(false);
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): State => ({
      quarter: (game.currentQuarter && String(game.currentQuarter)) || "Q1",
      timeInQuarter: (game.timeInQuarter as string) || "15:00",
      boxScore: buildBoxScoreForm(game),
      showOT: !!((game.boxScore || {}) as Record<string, unknown>)?.OT,
      stats: initStats(game, players),
      saving: false,
    })
  );

  const { quarter, timeInQuarter, boxScore, showOT, stats, saving } = state;
  const quarterKeys = [...QUARTERS, ...(showOT ? ["OT"] : [])];

  const totals = quarterKeys.reduce(
    (acc, q) => {
      const home = boxScore[q]?.home !== "" ? Number(boxScore[q].home) || 0 : 0;
      const away = boxScore[q]?.away !== "" ? Number(boxScore[q].away) || 0 : 0;
      acc.home += home;
      acc.away += away;
      return acc;
    },
    { home: 0, away: 0 }
  );

  const msuGoalTotal = stats
    .filter((s) => !s.isGoalie)
    .reduce((sum, s) => sum + (Number(s.goals) || 0), 0);
  const hasPlayerGoals = stats.some((s) => !s.isGoalie && (Number(s.goals) || 0) > 0);
  const msuScore = hasPlayerGoals ? msuGoalTotal : totals.home;

  const fieldStats = stats.map((stat, index) => ({ stat, index })).filter(({ stat }) => !stat.isGoalie);
  const goalieStats = stats.map((stat, index) => ({ stat, index })).filter(({ stat }) => stat.isGoalie);

  const handleSave = async (markFinal = false) => {
    dispatch({ type: "SAVE_START" });
    try {
      const cleanBoxScore: Record<string, { home: number; away: number }> = {};
      quarterKeys.forEach((q) => {
        const home =
          boxScore[q]?.home !== "" ? Number(boxScore[q].home) || 0 : undefined;
        const away =
          boxScore[q]?.away !== "" ? Number(boxScore[q].away) || 0 : undefined;
        if (home !== undefined || away !== undefined) {
          cleanBoxScore[q] = { home: home ?? 0, away: away ?? 0 };
        }
      });

      const cleanStats = stats
        .filter((stat) => stat.name?.trim())
        .map((stat) => {
          const clean: PlayerStat = {
            name: stat.name?.trim(),
            number: stat.number,
            isGoalie: !!stat.isGoalie,
          };
          if (stat.isGoalie) {
            if (stat.gamesPlayed) clean.gamesPlayed = Number(stat.gamesPlayed);
            if (stat.gamesStarted) clean.gamesStarted = Number(stat.gamesStarted);
            if (stat.saves) clean.saves = Number(stat.saves);
            if (stat.goalsAllowed) clean.goalsAllowed = Number(stat.goalsAllowed);
          } else {
            if (stat.goals) clean.goals = Number(stat.goals);
            if (stat.assists) clean.assists = Number(stat.assists);
            if (stat.shotsOnGoal) clean.shotsOnGoal = Number(stat.shotsOnGoal);
            if (stat.groundBalls) clean.groundBalls = Number(stat.groundBalls);
            if (stat.causedTurnovers) clean.causedTurnovers = Number(stat.causedTurnovers);
            if (stat.turnovers) clean.turnovers = Number(stat.turnovers);
            if (stat.faceoffWins) clean.faceoffWins = Number(stat.faceoffWins);
            if (stat.faceoffLosses) clean.faceoffLosses = Number(stat.faceoffLosses);
          }
          return clean;
        })
        .filter((stat) => {
          if (stat.isGoalie) return stat.saves || stat.goalsAllowed;
          return (
            stat.goals ||
            stat.assists ||
            stat.shotsOnGoal ||
            stat.groundBalls ||
            stat.causedTurnovers ||
            stat.faceoffWins ||
            stat.faceoffLosses
          );
        });

      const payload: Record<string, any> = {
        status: markFinal ? "final" : "live",
        currentQuarter: quarter,
        timeInQuarter,
        boxScore: Object.keys(cleanBoxScore).length ? cleanBoxScore : undefined,
        msuScore: msuScore,
        oppScore: totals.away,
        stats: cleanStats.length ? cleanStats : undefined,
      };

      if (markFinal) {
        payload.result = msuScore > totals.away ? "W" : msuScore < totals.away ? "L" : "T";
      }

      await updateLiveGame(game.id as string, payload);
      toast.success(markFinal ? "Game marked final!" : "Live update saved!");
    } catch (err) {
      console.error("Error updating live data:", err);
      toast.error("Error saving data. Check console.");
    } finally {
      dispatch({ type: "SAVE_END" });
    }
  };

  const renderFieldRow = ({ stat, index }: { stat: PlayerStat; index: number }) => (
    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
      <td className="p-2 font-semibold text-gray-800 text-xs">{stat.name}</td>
      {FIELD_KEYS.map((field) => {
        const key = field as FieldStatKey;
        return (
          <td key={key} className="p-2">
            <input
              type="number"
              min="0"
              value={stat[key] ?? ""}
              onChange={(e) =>
                dispatch({ type: "UPDATE_STAT", index, field: key, value: e.target.value })
              }
              className={inputClass}
            />
          </td>
        );
      })}
    </tr>
  );

  const renderGoalieRow = ({ stat, index }: { stat: PlayerStat; index: number }) => (
    <tr key={index} className="bg-white">
      <td className="p-2 font-semibold text-gray-800 text-xs">{stat.name}</td>
      <td className="p-2">
        <input
          type="number"
          min="0"
          value={stat.saves ?? ""}
          onChange={(e) =>
            dispatch({ type: "UPDATE_STAT", index, field: "saves", value: e.target.value })
          }
          className={ic}
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          min="0"
          value={stat.goalsAllowed ?? ""}
          onChange={(e) =>
            dispatch({ type: "UPDATE_STAT", index, field: "goalsAllowed", value: e.target.value })
          }
          className={ic}
        />
      </td>
    </tr>
  );

  const isFinal = game.status === "final";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg mt-4 max-w-5xl mx-auto overflow-hidden">
      {/* Header bar */}
      <div className="bg-[#5E0009] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">
            MSU vs {game.opponent as string}
          </h2>
          {isFinal ? (
            <span className="bg-white/15 border border-white/25 rounded px-2.5 py-0.5 text-white text-xs font-bold tracking-widest">
              FINAL
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-white/15 border border-white/25 rounded px-2.5 py-0.5">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold tracking-widest">LIVE</span>
            </span>
          )}
        </div>
        <span className="text-white/70 text-sm font-medium tabular-nums">
          {quarter} &middot; {timeInQuarter}
        </span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Score + Clock */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              Score
            </h3>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">MSU</div>
                <div className="text-5xl font-black text-[#5E0009] tabular-nums leading-none">{msuScore}</div>
              </div>
              <div className="text-2xl font-light text-gray-300 pb-1">–</div>
              <div className="text-center">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 truncate max-w-[100px]">
                  {game.opponent as string}
                </div>
                <div className="text-5xl font-black text-gray-700 tabular-nums leading-none">{totals.away}</div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Quarter</label>
                <select
                  value={quarter}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "quarter", value: e.target.value })}
                  className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 text-sm text-gray-800 focus:ring-1 focus:ring-[#5E0009] focus:outline-none w-20"
                >
                  {["Q1", "Q2", "Q3", "Q4", "OT"].map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Time Left</label>
                <input
                  type="text"
                  value={timeInQuarter}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "timeInQuarter", value: e.target.value })}
                  className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-24 text-center text-sm text-gray-800 focus:ring-1 focus:ring-[#5E0009] focus:outline-none"
                  placeholder="15:00"
                />
              </div>
            </div>
          </div>

          {/* Box Score */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
              Box Score
            </h3>
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  <th style={{ width: "3.5rem" }} />
                  {quarterKeys.map((q) => (
                    <th key={q} className="px-1 py-0.5 text-center text-gray-400 font-bold uppercase tracking-wide">
                      {q}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["home", "away"] as const).map((side, idx) => (
                  <tr key={side}>
                    <td className="pr-2 py-0.5 font-bold text-gray-700 text-xs" style={{ width: "3.5rem" }}>
                      {idx === 0 ? "MSU" : (game.opponent as string)?.slice(0, 3).toUpperCase() || "OPP"}
                    </td>
                    {quarterKeys.map((q) => (
                      <td key={`${side}-${q}`} className="px-1 py-0.5">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={boxScore[q]?.[side] ?? ""}
                          onChange={(e) => dispatch({ type: "SET_BOX", quarter: q, side, value: e.target.value })}
                          className="w-full border border-gray-200 bg-gray-50 rounded px-1 py-0.5 text-center text-xs focus:ring-1 focus:ring-[#5E0009] focus:outline-none"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => dispatch({ type: "TOGGLE_OT" })}
              className="text-xs font-semibold text-[#5E0009] hover:underline mt-2"
            >
              {showOT ? "− Remove OT" : "+ Add OT"}
            </button>
          </div>
        </div>

        {/* Player Stats */}
        <div className="mt-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
            Player Stats
          </h3>
          {stats.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No roster players available.</p>
          ) : (
            <>
              {fieldStats.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Field Players</h4>
                  <div className="overflow-x-auto rounded border border-gray-100">
                    <table className="w-full text-xs border-collapse min-w-[620px]">
                      <thead>
                        <tr className="bg-[#5E0009] text-white">
                          <th className="p-2 text-left w-28 font-semibold">Player</th>
                          <th className="p-2 text-center font-semibold">G</th>
                          <th className="p-2 text-center font-semibold">A</th>
                          <th className="p-2 text-center font-semibold">SH</th>
                          <th className="p-2 text-center font-semibold">GB</th>
                          <th className="p-2 text-center font-semibold">CT</th>
                          <th className="p-2 text-center font-semibold">TO</th>
                          <th className="p-2 text-center font-semibold">FOW</th>
                          <th className="p-2 text-center font-semibold">FOL</th>
                        </tr>
                      </thead>
                      <tbody>{fieldStats.map(renderFieldRow)}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {goalieStats.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Goalies</h4>
                  <div className="overflow-x-auto rounded border border-gray-100">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#5E0009] text-white">
                          <th className="p-2 text-left w-28 font-semibold">Player</th>
                          <th className="p-2 text-center font-semibold">S</th>
                          <th className="p-2 text-center font-semibold">GA</th>
                        </tr>
                      </thead>
                      <tbody>{goalieStats.map(renderGoalieRow)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="bg-[#5E0009] text-white text-sm font-semibold px-5 py-2 rounded hover:bg-red-900 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Live Update"}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-gray-800 text-white text-sm font-semibold px-5 py-2 rounded hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            Mark Final
          </button>
        </div>

        {/* Admin Stream Preview + Chat Moderation */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowStream((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#5E0009] transition-colors"
          >
            <span>{showStream ? "▾" : "▸"}</span>
            Stream Preview &amp; Chat Moderation
          </button>
          {showStream && (
            game.hlsUrl ? (
              <div className="mt-3 flex flex-col lg:flex-row gap-4" style={{ minHeight: "360px" }}>
                <div className="flex-1">
                  <StreamPlayer
                    signedUrl={game.hlsUrl as string}
                    sessionToken={null}
                    gameId={game.id as string}
                    program={program}
                    onSessionExpired={() => {}}
                  />
                </div>
                <div className="w-full lg:w-72" style={{ minHeight: "360px" }}>
                  <LiveChat
                    gameId={game.id as string}
                    program={program}
                    sessionToken={null}
                    displayName="Admin"
                    isModerator={true}
                    initialGuestName="Admin"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400 italic">
                No stream configured for this game. Set one up in Stream Setup.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
