import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../../../Services/API";
import type { ScheduleGame } from "../../../../types/schedule";

function getActiveSeason() {
  const stored = localStorage.getItem("selectedSeason");
  if (stored) return stored;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

export default function WUpcomingGames() {
  const [games, setGames] = useState<ScheduleGame[]>([]);

  useEffect(() => {
    const season = getActiveSeason();
    apiRequest<ScheduleGame[]>("/api/games")
      .then((data) => {
        const now = new Date();
        const upcoming = (data || [])
          .filter((g) => g.season === season && g.date && new Date(g.date) > now && !g.result)
          .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
          .slice(0, 3);
        setGames(upcoming);
      })
      .catch(() => {});
  }, []);

  if (games.length === 0) return null;

  return (
    <section className="bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-[#5E0009]">Upcoming Games</h2>
          <Link to="/women/schedule" className="text-sm text-[#5E0009] hover:underline font-medium">
            Full Schedule
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {games.map((g) => {
            const dateObj = new Date(g.date!);
            const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const timeStr = g.time || "";
            const isAway = g.type === "away";
            return (
              <div key={g.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center gap-3">
                  {g.awayLogo && (
                    <img src={g.awayLogo} alt={g.opponent || ""} className="w-10 h-10 object-contain" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {isAway ? "@ " : "vs "}{g.opponent}
                    </p>
                    <p className="text-xs text-gray-500">{dateStr}{timeStr ? ` · ${timeStr}` : ""}</p>
                  </div>
                </div>
                {g.location && (
                  <p className="text-xs text-gray-400 truncate">{g.location}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
