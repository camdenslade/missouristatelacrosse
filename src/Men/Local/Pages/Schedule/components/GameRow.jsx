// src/Men/Local/Pages/Schedule/components/GameRow.jsx
import { useState } from "react";

export default function GameRow({
  game,
  index,
  isAdmin,
  onEdit,
  onDelete,
  onEnterScore,
  onClearScore,
}) {
  const [showStats, setShowStats] = useState(false);
  const bgColor = index % 2 === 0 ? "bg-white" : "bg-gray-100";

  const isHome = game.type === "home";
  const vsAtText = isHome ? "vs" : "at";
  const boxBg = isHome ? "bg-gray-300 text-black" : "bg-[#5E0009] text-white";

  const mapsUrl = game.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.location)}`
    : "";

  const formatDate = (d) => {
    try{
      const date = d instanceof Date ? d : new Date(d);
      return isNaN(date)
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
      if (isNaN(date) || !game.time || game.time === "TBD") return "TBD";
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
      className={`flex flex-col sm:flex-row items-center justify-between w-full ${bgColor} p-5 border-b border-gray-300 transition`}
    >
      {/* Date + Time */}
      <div className="flex flex-col text-center sm:text-left w-40">
        <span className="font-semibold text-gray-800 text-lg">
          {formatDate(game.dateObj || game.date)}
        </span>
        <span className="text-gray-600">{formatTime(game.dateObj || game.date)}</span>
      </div>

      {/* Opponent Info */}
      <div className="flex flex-col sm:flex-row items-center gap-5 flex-grow text-center sm:text-left">
        {/* Logo */}
        {game.awayLogo && (
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
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

        {/* Opponent / Classification */}
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

          {/* Location */}
          <div className="text-gray-700 text-sm mt-1 font-medium">
            {game.location && game.location !== "TBD" ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {game.location}
              </a>
            ) : (
              <span>{game.location || "TBD"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Score + Stats */}
      <div className="flex flex-col w-[140px] text-right">
        {renderScore()}
        {(game.boxScore || game.stats) && (
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-sm text-[#5E0009] hover:underline mt-1"
          >
            {showStats ? "Hide Stats" : "View Stats"}
          </button>
        )}
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="flex flex-col px-0 sm:px-4 mt-2 sm:mt-0 gap-1">
          <button
            onClick={() => onEnterScore(game)}
            className="px-3 py-1 bg-[#5E0009] text-white w-full sm:w-auto hover:bg-red-800 transition"
          >
            Enter Score
          </button>

          {typeof game.msuScore === "number" && typeof game.oppScore === "number" && (
            <button
              onClick={() => onClearScore(game)}
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

      {/* Stats Dropdown */}
      {showStats && (
        <div className="w-full mt-4 bg-gray-50 border rounded-md p-3 text-sm">
          {/* Box Score */}
          {game.boxScore && (
            <div className="mb-3">
              <h4 className="font-semibold text-gray-800 mb-1">Box Score</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                {Object.entries(game.boxScore).map(([q, val]) => (
                  <div key={q} className="border border-gray-300 rounded py-1">
                    <span className="font-semibold">{q}</span>
                    <div className="text-gray-700">
                      {val.home} - {val.away}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player Stats */}
          {Array.isArray(game.stats) && game.stats.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">Player Stats</h4>
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b font-semibold bg-gray-200">
                    <th className="p-1 text-left">Player</th>
                    <th className="p-1 text-center">G</th>
                    <th className="p-1 text-center">A</th>
                    <th className="p-1 text-center">GB</th>
                    <th className="p-1 text-center">Saves</th>
                  </tr>
                </thead>
                <tbody>
                  {game.stats.map((s, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-1">{s.name}</td>
                      <td className="p-1 text-center">{s.goals ?? 0}</td>
                      <td className="p-1 text-center">{s.assists ?? 0}</td>
                      <td className="p-1 text-center">{s.groundBalls ?? 0}</td>
                      <td className="p-1 text-center">{s.saves ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
