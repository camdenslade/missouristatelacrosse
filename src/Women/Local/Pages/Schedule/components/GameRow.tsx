// src/Women/Local/Pages/Schedule/components/GameRow.jsx
import { useState } from "react";
import type { BoxScoreEntry, ScheduleGame } from "../../../../../types/schedule";

const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4", "OT"];

type GameRowProps = {
  game: ScheduleGame;
  index: number;
  isAdmin: boolean;
  numberMap?: Map<string, string | number>;
  onEdit: (game: ScheduleGame) => void;
  onDelete: (game: ScheduleGame) => void;
  onEnterScore: (game: ScheduleGame) => void;
  onClearScore?: (game: ScheduleGame) => void;
};

export default function GameRow({
  game,
  index,
  isAdmin,
  numberMap,
  onEdit,
  onDelete,
  onEnterScore,
  onClearScore,
}: GameRowProps) {
  const [showStats, setShowStats] = useState(false);
  const bgColor = index % 2 === 0 ? "bg-white" : "bg-gray-100";
  const getNumber = (name?: string, num?: string | number | null) =>
    num ?? (name ? numberMap?.get(name.toLowerCase()) : undefined) ?? "-";

  const isHome = game.type === "home";
  const vsAtText = isHome ? "vs" : "at";
  const boxBg = isHome ? "bg-gray-300 text-black" : "bg-[#5E0009] text-white";

  const mapsUrl = game.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.location)}`
    : "";

  const formatDate = (d) => {
    try{
      const date = d instanceof Date ? d : new Date(d);
      return isNaN(date.getTime())
        ? "TBD"
        : date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            weekday: "short",
            timeZone: "America/Chicago",
          });
    } catch{
      return "TBD";
    }
  };

  const formatTime = (d) => {
    try{
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime()) || !game.time || game.time === "TBD") return "TBD";
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
      });
    } catch{
      return "TBD";
    }
  };

  const renderScore = () => {
    if (typeof game.msuScore !== "number" || typeof game.oppScore !== "number")
      return null;
    const result =
      game.msuScore > game.oppScore ? "W" : game.msuScore < game.oppScore ? "L" : "T";
    return (
      <span className="italic font-bold text-2xl text-gray-800 whitespace-nowrap">
        {`${result}, ${game.msuScore}-${game.oppScore}`}
      </span>
    );
  };

  return (
    <div
      className={`flex items-start w-full ${bgColor} p-5 border-b border-gray-300 transition`}
    >
      {/* Left content — everything except admin buttons */}
      <div className="flex-1 min-w-0">
        {/* Main row */}
        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3">
          {/* Date + Time */}
          <div className="flex flex-col text-center sm:text-left w-40 shrink-0">
            <span className="font-semibold text-gray-800 text-lg">
              {formatDate(game.dateObj || game.date)}
            </span>
            <span className="text-gray-600">{formatTime(game.dateObj || game.date)}</span>
          </div>

          {/* Opponent Info */}
          <div className="flex flex-col sm:flex-row items-center gap-5 flex-grow text-center sm:text-left">
            {game.awayLogo && (
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                {game.awayLink ? (
                  <a href={game.awayLink} target="_blank" rel="noopener noreferrer">
                    <img
                      src={game.awayLogo}
                      alt={`${game.opponent || "Opponent"} logo`}
                      className="h-full w-full object-contain drop-shadow-sm"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </a>
                ) : (
                  <img
                    src={game.awayLogo}
                    alt={`${game.opponent || "Opponent"} logo`}
                    className="h-full w-full object-contain drop-shadow-sm"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
              </div>
            )}

            <div className="flex flex-col items-center sm:items-start leading-tight">
              <div className="flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-900">
                <span className={`${boxBg} px-2 py-0.5 rounded text-sm uppercase`}>
                  {vsAtText}
                </span>
                {game.awayLink ? (
                  <a
                    href={game.awayLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {game.opponent || "TBD"}
                  </a>
                ) : (
                  game.opponent || "TBD"
                )}
              </div>

              <div className="text-gray-700 text-sm mt-1 font-medium">
                {game.location && game.location !== "TBD" ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {game.location}
                  </a>
                ) : (
                  <span>{game.location || "TBD"}</span>
                )}
              </div>
              {(game.boxScore || game.stats) && (
                <button
                  onClick={() => setShowStats(!showStats)}
                  className="text-sm text-[#5E0009] hover:underline mt-1"
                >
                  {showStats ? "Hide Stats" : "View Stats"}
                </button>
              )}
            </div>
          </div>

          {/* Score + Box Score */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col w-[140px] text-right">
              {renderScore()}
            </div>

            {game.boxScore && (() => {
              const quarters = Object.entries(game.boxScore).sort(
                (a, b) => QUARTER_ORDER.indexOf(a[0]) - QUARTER_ORDER.indexOf(b[0])
              ) as [string, BoxScoreEntry][];
              if (quarters.length === 0) return null;
              return (
                <table className="text-xs border-collapse hidden sm:table">
                  <thead>
                    <tr>
                      <th className="px-1" />
                      {quarters.map(([q]) => (
                        <th key={q} className="px-1.5 py-0.5 text-center font-semibold text-gray-500">
                          {q}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-1 font-semibold text-gray-800">MSU</td>
                      {quarters.map(([q, val]) => (
                        <td key={q} className="px-1.5 py-0.5 text-center font-medium">
                          {val.home ?? "-"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-1 font-semibold text-gray-800">
                        {game.opponent ? game.opponent.slice(0, 3).toUpperCase() : "OPP"}
                      </td>
                      {quarters.map(([q, val]) => (
                        <td key={q} className="px-1.5 py-0.5 text-center text-gray-600">
                          {val.away ?? "-"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>

        {/* Stats (expands below main row, still left of admin buttons) */}
        {showStats && (
          <div className="mt-4 bg-gray-50 border rounded-md p-4 text-sm">
            {Array.isArray(game.stats) && game.stats.length > 0 && (() => {
              const fieldPlayers = game.stats.filter((s) => !s.isGoalie);
              const goalies = game.stats.filter((s) => s.isGoalie);
              return (
                <>
                  {fieldPlayers.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#5E0009] mb-2 text-base">Field Player Stats</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm border-collapse min-w-[550px]">
                          <thead>
                            <tr className="bg-[#5E0009] text-white">
                              <th className="p-1.5 text-center w-10">#</th>
                              <th className="p-1.5 text-left">Player</th>
                              <th className="p-1.5 text-center">G</th>
                              <th className="p-1.5 text-center">A</th>
                              <th className="p-1.5 text-center">PTS</th>
                              <th className="p-1.5 text-center">SH</th>
                              <th className="p-1.5 text-center">GB</th>
                              <th className="p-1.5 text-center">CT</th>
                              <th className="p-1.5 text-center">TO</th>
                              <th className="p-1.5 text-center">DC</th>
                              <th className="p-1.5 text-center">DL</th>
                              <th className="p-1.5 text-center">DC%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fieldPlayers.map((s, i) => {
                              const foW = s.faceoffWins ?? 0;
                              const foL = s.faceoffLosses ?? 0;
                              const foTotal = foW + foL;
                              const foPct = foTotal > 0 ? ((foW / foTotal) * 100).toFixed(1) + "%" : "-";
                              return (
                                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
                                  <td className="p-1.5 text-center font-medium text-gray-500">{getNumber(s.name, s.number)}</td>
                                  <td className="p-1.5 font-medium">{s.name}</td>
                                  <td className="p-1.5 text-center">{s.goals ?? 0}</td>
                                  <td className="p-1.5 text-center">{s.assists ?? 0}</td>
                                  <td className="p-1.5 text-center font-bold">{(s.goals ?? 0) + (s.assists ?? 0)}</td>
                                  <td className="p-1.5 text-center">{s.shotsOnGoal ?? 0}</td>
                                  <td className="p-1.5 text-center">{s.groundBalls ?? 0}</td>
                                  <td className="p-1.5 text-center">{s.causedTurnovers ?? 0}</td>
                                  <td className="p-1.5 text-center">{s.turnovers ?? 0}</td>
                                  <td className="p-1.5 text-center">{foW}</td>
                                  <td className="p-1.5 text-center">{foL}</td>
                                  <td className="p-1.5 text-center">{foPct}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {goalies.length > 0 && (
                    <div className={fieldPlayers.length > 0 ? "mt-4" : ""}>
                      <h4 className="font-semibold text-[#5E0009] mb-2 text-base">Goalie Stats</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm border-collapse">
                          <thead>
                            <tr className="bg-[#5E0009] text-white">
                              <th className="p-1.5 text-center w-10">#</th>
                              <th className="p-1.5 text-left">Player</th>
                              <th className="p-1.5 text-center">S</th>
                              <th className="p-1.5 text-center">GA</th>
                              <th className="p-1.5 text-center">SV%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {goalies.map((s, i) => {
                              const saves = s.saves ?? 0;
                              const ga = s.goalsAllowed ?? 0;
                              const total = saves + ga;
                              const svPct = total > 0 ? ((saves / total) * 100).toFixed(1) + "%" : "-";
                              return (
                                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
                                  <td className="p-1.5 text-center font-medium text-gray-500">{getNumber(s.name, s.number)}</td>
                                  <td className="p-1.5 font-medium">{s.name}</td>
                                  <td className="p-1.5 text-center">{saves}</td>
                                  <td className="p-1.5 text-center">{ga}</td>
                                  <td className="p-1.5 text-center font-bold">{svPct}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Admin Controls — pinned right */}
      {isAdmin && (
        <div className="flex flex-col px-0 sm:px-4 mt-2 sm:mt-0 gap-1 shrink-0">
          <button
            onClick={() => onEnterScore(game)}
            className="px-3 py-1 bg-[#5E0009] text-white w-full sm:w-auto hover:bg-red-800 transition"
          >
            Enter Score
          </button>

          {typeof game.msuScore === "number" && typeof game.oppScore === "number" && (
            <button
              onClick={() => onClearScore?.(game)}
              className="px-3 py-1 bg-[#999898] text-white w-full sm:w-auto hover:bg-[#7e7e7e] transition"
            >
              Clear Score
            </button>
          )}

          <button
            onClick={() => onEdit(game)}
            className="px-3 py-1 bg-[#7a7979] text-white w-full sm:w-auto hover:bg-[#6a6a6a] transition"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(game)}
            className="px-3 py-1 bg-[#3b3b3b] text-white w-full sm:w-auto hover:bg-[#2f2f2f] transition"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
