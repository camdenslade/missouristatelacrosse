import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchActiveSeasonCode } from "../../../../Global/Common/utils/seasonUtils";
import { apiRequest } from "../../../../Services/API";
import type { ScheduleGame } from "../../../../types/schedule";

async function getActiveSeason() {
  const stored = localStorage.getItem("selectedSeason");
  if (stored) return stored;
  return fetchActiveSeasonCode();
}

export default function WUpcomingGames() {
  const [games, setGames] = useState<ScheduleGame[]>([]);

  useEffect(() => {
    (async () => {
      const season = await getActiveSeason();
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
    })();
  }, []);

  if (games.length === 0) return null;

  return (
    <section className="bg-white py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
              <span className="h-px w-6 bg-[#5E0009]/40" />
              Schedule
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Upcoming Games</h2>
          </div>
          <Link
            to="/women/schedule"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#5E0009] hover:text-[#7a0012] transition whitespace-nowrap"
          >
            Full Schedule
            <ChevronRight size={16} strokeWidth={3} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {games.map((g) => {
            const dateObj = new Date(g.date!);
            const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const timeStr = g.time || "";
            const isAway = g.type === "away";
            return (
              <div
                key={g.id}
                className="group border border-gray-100 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all bg-white"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      isAway ? "bg-gray-100 text-gray-600" : "bg-[#5E0009]/10 text-[#5E0009]"
                    }`}
                  >
                    {isAway ? "Away" : "Home"}
                  </span>
                  <span className="text-xs text-gray-400">{dateStr}</span>
                </div>
                <div className="flex items-center gap-3">
                  {g.awayLogo && (
                    <img src={g.awayLogo} alt={g.opponent || ""} className="w-10 h-10 object-contain" />
                  )}
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {isAway ? "@ " : "vs "}{g.opponent}
                    </p>
                    {timeStr && <p className="text-xs text-gray-500">{timeStr}</p>}
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
