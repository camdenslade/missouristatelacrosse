import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRaffles } from "../../../../Global/Common/hooks/useRaffles";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiRaffle } from "../../../../types/api";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function useCountdown(endTime: string | null | undefined) {
  const getSecsLeft = () =>
    endTime ? Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000)) : null;

  const [secsLeft, setSecsLeft] = useState<number | null>(getSecsLeft);

  useEffect(() => {
    if (secsLeft === null) return;
    if (secsLeft === 0) return;
    const id = setInterval(() => setSecsLeft(getSecsLeft()), 1000);
    return () => clearInterval(id);
  });

  return secsLeft;
}

function Countdown({ endTime }: { endTime: string | null | undefined }) {
  const secs = useCountdown(endTime);
  if (secs === null) return null;

  if (secs === 0) {
    return <span className="text-xs font-semibold text-red-500">Ending now</span>;
  }

  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  const parts = d > 0
    ? `${d}d ${h}h ${m}m`
    : h > 0
    ? `${h}h ${m}m ${s}s`
    : `${m}m ${s}s`;

  const urgent = secs < 3600;

  return (
    <span className={`text-xs font-semibold tabular-nums ${urgent ? "text-red-500" : "text-[#5E0009]"}`}>
      {parts}
    </span>
  );
}

export default function Raffles() {
  const { base } = getProgramInfo();
  const navigate = useNavigate();
  const [raffles, setRaffles] = useState<ApiRaffle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRaffles()
      .then(setRaffles)
      .catch(() => setRaffles([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-pulse text-gray-500">Loading raffles...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#5E0009] mb-2">Raffles</h1>
      <p className="text-gray-500 mb-8">Enter for a chance to win.</p>

      {raffles.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-lg">
          No raffles are currently available.
        </div>
      ) : (
        <div className="grid gap-5">
          {raffles.map((raffle) => (
            <RaffleCard
              key={raffle.id}
              raffle={raffle}
              onEnter={() => navigate(`${base}/raffles/${raffle.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RaffleCard({ raffle, onEnter }: { raffle: ApiRaffle; onEnter: () => void }) {
  const isFree = !raffle.ticketPrice || Number(raffle.ticketPrice) <= 0;
  const isClosed = raffle.status !== "active";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col sm:flex-row">
      {raffle.image && (
        <img
          src={raffle.image}
          alt={raffle.name}
          className="w-full sm:w-48 h-40 sm:h-auto object-contain bg-gray-50 shrink-0"
        />
      )}
      <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">{raffle.name}</h2>
            {raffle.allowBids && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Bid</span>
            )}
            {isClosed && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                raffle.status === "drawn" ? "bg-purple-100 text-purple-700" : "bg-yellow-100 text-yellow-700"
              }`}>
                {raffle.status === "drawn" ? "Winner Drawn" : "Closed"}
              </span>
            )}
          </div>

          {raffle.description && (
            <p className="text-gray-500 text-sm mb-2 line-clamp-2">{raffle.description}</p>
          )}

          {raffle.winnerName && (
            <p className="text-sm text-purple-700 font-medium mb-1">🏆 Winner: {raffle.winnerName}</p>
          )}

          {raffle.endTime && (
            <div className="mt-1">
              {isClosed ? (
                <p className="text-xs text-gray-400">Ended: {fmtDate(raffle.endTime)}</p>
              ) : (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  Ends in: <Countdown endTime={raffle.endTime} />
                  <span className="text-gray-300 mx-0.5">·</span>
                  {fmtDate(raffle.endTime)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <div className="text-2xl font-bold text-[#5E0009]">
              {isFree ? "Free" : `$${Number(raffle.ticketPrice).toFixed(2)}`}
            </div>
            <div className="text-xs text-gray-400">
              {raffle.allowBids ? "min bid" : "per ticket"}
            </div>
          </div>
          {!isClosed && (
            <button
              onClick={onEnter}
              className="px-5 py-2 bg-[#5E0009] text-white rounded-lg font-semibold hover:bg-[#7a0010] transition-colors text-sm"
            >
              {raffle.allowBids ? "Place Bid" : "Enter Raffle"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
