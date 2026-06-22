import { useState } from "react";
import type { SyntheticEvent } from "react";
import { apiRequest } from "../../../../../Services/API";
import type { Player } from "../types";

type PlayerRowProps = {
  player: Player;
  index: number;
  season: string;
  onEdit?: (player: Player) => void;
  onDelete?: (player: Player) => void;
  isAdmin?: boolean;
};

interface GameEntry {
  opponent: string;
  date: string;
  result?: string;
  msuScore?: number;
  oppScore?: number;
  isGoalie: boolean;
  goals?: number;
  assists?: number;
  shotsOnGoal?: number;
  groundBalls?: number;
  causedTurnovers?: number;
  turnovers?: number;
  faceoffWins?: number;
  faceoffLosses?: number;
  saves?: number;
  goalsAllowed?: number;
}

function normSeason(s: string): string {
  if (!s) return s;
  if (/^\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s.slice(2, 4)}-${s.slice(5, 7)}`;
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s, 10);
    return `${String(y - 1).slice(-2)}-${String(y).slice(-2)}`;
  }
  return s;
}

function foPct(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "–";
  return `${((wins / total) * 100).toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
  } catch { return ""; }
}

const n = (v?: number) => (v != null ? v : 0);

export default function PlayerRow({ player, index, season, onEdit, onDelete, isAdmin }: PlayerRowProps) {
  const { name, number, position, height, weight, classYear, hometown, state, highSchool, previousSchool, photo } = player;

  const [showStats, setShowStats] = useState(false);
  const [entries, setEntries] = useState<GameEntry[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const bg = index % 2 === 0 ? "bg-white" : "bg-gray-100";
  const imgSrc = photo || "/assets/placeholder.png";

  const handleNameClick = () => {
    const next = !showStats;
    setShowStats(next);
    if (next && entries === null && !loadingStats) {
      setLoadingStats(true);
      apiRequest<any[]>("/api/games")
        .then((games) => {
          const results: GameEntry[] = [];
          for (const game of games) {
            if (normSeason(game.season || "") !== season) continue;
            let extra: Record<string, any> = {};
            if (game.data && typeof game.data === "string") {
              try { extra = JSON.parse(game.data); } catch { /* skip */ }
            } else if (game.data && typeof game.data === "object") {
              extra = game.data;
            }
            const stats: any[] = Array.isArray(extra.stats) ? extra.stats
              : Array.isArray(extra.playerStats) ? extra.playerStats : [];
            const match = stats.find(
              (s: any) => typeof s.name === "string" &&
                s.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            if (!match) continue;
            results.push({
              opponent: game.opponent || "Opponent",
              date: game.date || "",
              result: extra.result,
              msuScore: extra.msuScore,
              oppScore: extra.oppScore,
              isGoalie: !!match.isGoalie,
              goals: match.goals, assists: match.assists, shotsOnGoal: match.shotsOnGoal,
              groundBalls: match.groundBalls, causedTurnovers: match.causedTurnovers,
              turnovers: match.turnovers, faceoffWins: match.faceoffWins,
              faceoffLosses: match.faceoffLosses, saves: match.saves, goalsAllowed: match.goalsAllowed,
            });
          }
          results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setEntries(results);
        })
        .catch(() => setEntries([]))
        .finally(() => setLoadingStats(false));
    }
  };

  const isGoalie = entries?.length ? entries[0].isGoalie : false;
  const totals = (entries || []).reduce(
    (acc, e) => {
      acc.goals += Number(e.goals) || 0;
      acc.assists += Number(e.assists) || 0;
      acc.shotsOnGoal += Number(e.shotsOnGoal) || 0;
      acc.groundBalls += Number(e.groundBalls) || 0;
      acc.causedTurnovers += Number(e.causedTurnovers) || 0;
      acc.turnovers += Number(e.turnovers) || 0;
      acc.faceoffWins += Number(e.faceoffWins) || 0;
      acc.faceoffLosses += Number(e.faceoffLosses) || 0;
      acc.saves += Number(e.saves) || 0;
      acc.goalsAllowed += Number(e.goalsAllowed) || 0;
      return acc;
    },
    { goals: 0, assists: 0, shotsOnGoal: 0, groundBalls: 0, causedTurnovers: 0,
      turnovers: 0, faceoffWins: 0, faceoffLosses: 0, saves: 0, goalsAllowed: 0 }
  );

  const infoLine = (
    <div className="text-black">
      {classYear && <span className="font-bold">{classYear}</span>}
      {classYear && " / "}
      {hometown && `${hometown}`}
      {state && `, ${state}`}
      {` / ${highSchool || ""}`}
      {previousSchool && ` / ${previousSchool}`}
    </div>
  );

  return (
    <div className={`flex flex-col w-full ${bg} border-b border-gray-200`}>
      {/* Main row */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start p-4">
        <img
          src={imgSrc}
          alt={name}
          className="w-24 h-36 object-cover rounded-md mr-0 sm:mr-4 mb-2 sm:mb-0 border border-gray-300"
          onError={(e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = "/assets/placeholder.png"; }}
        />

        <div className="flex-1 flex flex-col sm:flex-row justify-between w-full sm:h-36">
          <div className="flex flex-col justify-center text-left">
            <div className="text-black text-md">
              <span className="font-bold">{position}</span>
              {height && weight && ` | ${height}" | ${weight} lbs`}
            </div>
            <div className="flex items-center mt-2">
              <span className="inline-block w-10 text-center px-2 py-1 bg-[#5E0009] text-white font-bold mr-3">
                {number}
              </span>
              <button
                onClick={handleNameClick}
                className="text-gray-800 font-bold text-2xl hover:text-[#5E0009] transition-colors flex items-center gap-1.5 text-left"
              >
                {name}
                <span className="text-sm text-gray-400 font-normal">{showStats ? "▴" : "▾"}</span>
              </button>
            </div>
            <div className="sm:hidden mt-2 text-sm">{infoLine}</div>
          </div>
          <div className="hidden sm:flex flex-col justify-center text-right text-md">
            {infoLine}
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 mt-3 sm:mt-0 sm:ml-4">
            <button onClick={() => onEdit?.(player)} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">
              Edit
            </button>
            <button onClick={() => onDelete?.(player)} className="px-3 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded text-sm">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Stats dropdown */}
      {showStats && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
          {loadingStats ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No stats recorded this season.</p>
          ) : isGoalie ? (
            <div className="overflow-x-auto pt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#5E0009] text-white">
                    <th className="p-2 text-left font-semibold">Date</th>
                    <th className="p-2 text-left font-semibold">Opponent</th>
                    <th className="p-2 text-center font-semibold">Result</th>
                    <th className="p-2 text-center font-semibold">S</th>
                    <th className="p-2 text-center font-semibold">GA</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
                      <td className="p-2 text-gray-500 tabular-nums">{fmtDate(e.date)}</td>
                      <td className="p-2 font-medium text-gray-800">{e.opponent}</td>
                      <td className="p-2 text-center">
                        {e.result
                          ? <span className={`font-bold ${e.result === "W" ? "text-green-600" : e.result === "L" ? "text-red-600" : "text-gray-500"}`}>{e.result} {e.msuScore}–{e.oppScore}</span>
                          : "–"}
                      </td>
                      <td className="p-2 text-center">{n(e.saves)}</td>
                      <td className="p-2 text-center">{n(e.goalsAllowed)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold border-t-2 border-gray-300">
                    <td colSpan={3} className="p-2 text-gray-700">Totals ({entries.length} GP)</td>
                    <td className="p-2 text-center">{totals.saves}</td>
                    <td className="p-2 text-center">{totals.goalsAllowed}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto pt-3">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-[#5E0009] text-white">
                    <th className="p-2 text-left font-semibold">Date</th>
                    <th className="p-2 text-left font-semibold">Opponent</th>
                    <th className="p-2 text-center font-semibold">Result</th>
                    <th className="p-2 text-center font-semibold">G</th>
                    <th className="p-2 text-center font-semibold">A</th>
                    <th className="p-2 text-center font-semibold">SH</th>
                    <th className="p-2 text-center font-semibold">GB</th>
                    <th className="p-2 text-center font-semibold">CT</th>
                    <th className="p-2 text-center font-semibold">TO</th>
                    <th className="p-2 text-center font-semibold">FOW</th>
                    <th className="p-2 text-center font-semibold">FOL</th>
                    <th className="p-2 text-center font-semibold">FO%</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
                      <td className="p-2 text-gray-500 tabular-nums">{fmtDate(e.date)}</td>
                      <td className="p-2 font-medium text-gray-800">{e.opponent}</td>
                      <td className="p-2 text-center">
                        {e.result
                          ? <span className={`font-bold ${e.result === "W" ? "text-green-600" : e.result === "L" ? "text-red-600" : "text-gray-500"}`}>{e.result} {e.msuScore}–{e.oppScore}</span>
                          : "–"}
                      </td>
                      <td className="p-2 text-center">{n(e.goals)}</td>
                      <td className="p-2 text-center">{n(e.assists)}</td>
                      <td className="p-2 text-center">{n(e.shotsOnGoal)}</td>
                      <td className="p-2 text-center">{n(e.groundBalls)}</td>
                      <td className="p-2 text-center">{n(e.causedTurnovers)}</td>
                      <td className="p-2 text-center">{n(e.turnovers)}</td>
                      <td className="p-2 text-center">{n(e.faceoffWins)}</td>
                      <td className="p-2 text-center">{n(e.faceoffLosses)}</td>
                      <td className="p-2 text-center">{foPct(Number(e.faceoffWins) || 0, Number(e.faceoffLosses) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold border-t-2 border-gray-300">
                    <td colSpan={3} className="p-2 text-gray-700">Totals ({entries.length} GP)</td>
                    <td className="p-2 text-center">{totals.goals}</td>
                    <td className="p-2 text-center">{totals.assists}</td>
                    <td className="p-2 text-center">{totals.shotsOnGoal}</td>
                    <td className="p-2 text-center">{totals.groundBalls}</td>
                    <td className="p-2 text-center">{totals.causedTurnovers}</td>
                    <td className="p-2 text-center">{totals.turnovers}</td>
                    <td className="p-2 text-center">{totals.faceoffWins}</td>
                    <td className="p-2 text-center">{totals.faceoffLosses}</td>
                    <td className="p-2 text-center">{foPct(totals.faceoffWins, totals.faceoffLosses)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
