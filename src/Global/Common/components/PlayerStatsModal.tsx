import { useEffect, useState } from "react";
import { apiRequest } from "../../../Services/API";

interface GameStat {
  isGoalie?: boolean;
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

interface GameEntry {
  opponent: string;
  date: string;
  result?: string;
  msuScore?: number;
  oppScore?: number;
  stat: GameStat;
}

interface PlayerStatsModalProps {
  playerName: string;
  season: string;
  onClose: () => void;
}

function foPct(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "–";
  return `${((wins / total) * 100).toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
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

export default function PlayerStatsModal({ playerName, season, onClose }: PlayerStatsModalProps) {
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<any[]>("/api/games")
      .then((games) => {
        const results: GameEntry[] = [];

        for (const game of games) {
          // Normalize season
          if (normSeason(game.season || "") !== season) continue;

          // Parse data JSONB
          let extra: Record<string, any> = {};
          if (game.data && typeof game.data === "string") {
            try { extra = JSON.parse(game.data); } catch { /* skip */ }
          } else if (game.data && typeof game.data === "object") {
            extra = game.data as Record<string, any>;
          }

          const stats: any[] = Array.isArray(extra.stats)
            ? extra.stats
            : Array.isArray(extra.playerStats)
            ? extra.playerStats
            : [];

          const match = stats.find(
            (s: any) => typeof s.name === "string" &&
              s.name.trim().toLowerCase() === playerName.trim().toLowerCase()
          );
          if (!match) continue;

          // Only include games where at least one stat value was recorded
          const hasData = match.isGoalie
            ? (match.saves != null || match.goalsAllowed != null)
            : (match.goals || match.assists || match.shotsOnGoal || match.groundBalls ||
               match.causedTurnovers || match.turnovers || match.faceoffWins || match.faceoffLosses);
          if (!hasData) continue;

          results.push({
            opponent: game.opponent || "Opponent",
            date: game.date || "",
            result: extra.result,
            msuScore: extra.msuScore,
            oppScore: extra.oppScore,
            stat: match as GameStat,
          });
        }

        results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setEntries(results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playerName, season]);

  const isGoalie = entries.length > 0 && entries[0].stat.isGoalie;

  const totals = entries.reduce(
    (acc, e) => {
      const s = e.stat;
      acc.goals += Number(s.goals) || 0;
      acc.assists += Number(s.assists) || 0;
      acc.shotsOnGoal += Number(s.shotsOnGoal) || 0;
      acc.groundBalls += Number(s.groundBalls) || 0;
      acc.causedTurnovers += Number(s.causedTurnovers) || 0;
      acc.turnovers += Number(s.turnovers) || 0;
      acc.faceoffWins += Number(s.faceoffWins) || 0;
      acc.faceoffLosses += Number(s.faceoffLosses) || 0;
      acc.saves += Number(s.saves) || 0;
      acc.goalsAllowed += Number(s.goalsAllowed) || 0;
      return acc;
    },
    { goals: 0, assists: 0, shotsOnGoal: 0, groundBalls: 0, causedTurnovers: 0,
      turnovers: 0, faceoffWins: 0, faceoffLosses: 0, saves: 0, goalsAllowed: 0 }
  );

  const n = (v?: number) => (v != null && v !== 0 ? v : "–");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#5E0009] px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{playerName}</h2>
            <p className="text-white/70 text-xs">Season Stats — {season}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="w-8 h-8 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-gray-400 py-16 text-sm">
              No stats recorded for {playerName} this season.
            </div>
          ) : isGoalie ? (
            /* ── Goalie table ── */
            <div className="overflow-x-auto">
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
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 text-gray-500 tabular-nums">{fmtDate(e.date)}</td>
                      <td className="p-2 font-medium text-gray-800">{e.opponent}</td>
                      <td className="p-2 text-center">
                        {e.result ? (
                          <span className={`font-bold ${e.result === "W" ? "text-green-600" : e.result === "L" ? "text-red-600" : "text-gray-500"}`}>
                            {e.result} {e.msuScore}–{e.oppScore}
                          </span>
                        ) : "–"}
                      </td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.saves)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.goalsAllowed)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td colSpan={3} className="p-2 text-gray-700">Totals ({entries.length} GP)</td>
                    <td className="p-2 text-center text-gray-800">{totals.saves}</td>
                    <td className="p-2 text-center text-gray-800">{totals.goalsAllowed}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* ── Field player table ── */
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[680px]">
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
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 text-gray-500 tabular-nums">{fmtDate(e.date)}</td>
                      <td className="p-2 font-medium text-gray-800">{e.opponent}</td>
                      <td className="p-2 text-center">
                        {e.result ? (
                          <span className={`font-bold ${e.result === "W" ? "text-green-600" : e.result === "L" ? "text-red-600" : "text-gray-500"}`}>
                            {e.result} {e.msuScore}–{e.oppScore}
                          </span>
                        ) : "–"}
                      </td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.goals)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.assists)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.shotsOnGoal)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.groundBalls)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.causedTurnovers)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.turnovers)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.faceoffWins)}</td>
                      <td className="p-2 text-center text-gray-700">{n(e.stat.faceoffLosses)}</td>
                      <td className="p-2 text-center text-gray-700">
                        {foPct(Number(e.stat.faceoffWins) || 0, Number(e.stat.faceoffLosses) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td colSpan={3} className="p-2 text-gray-700">Totals ({entries.length} GP)</td>
                    <td className="p-2 text-center text-gray-800">{totals.goals}</td>
                    <td className="p-2 text-center text-gray-800">{totals.assists}</td>
                    <td className="p-2 text-center text-gray-800">{totals.shotsOnGoal}</td>
                    <td className="p-2 text-center text-gray-800">{totals.groundBalls}</td>
                    <td className="p-2 text-center text-gray-800">{totals.causedTurnovers}</td>
                    <td className="p-2 text-center text-gray-800">{totals.turnovers}</td>
                    <td className="p-2 text-center text-gray-800">{totals.faceoffWins}</td>
                    <td className="p-2 text-center text-gray-800">{totals.faceoffLosses}</td>
                    <td className="p-2 text-center text-gray-800">
                      {foPct(totals.faceoffWins, totals.faceoffLosses)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
