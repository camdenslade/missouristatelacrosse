// src/Women/Local/Pages/Schedule/components/HighlightGame.jsx
import { addHours, isWithinInterval, subHours } from "date-fns";
import { useEffect, useReducer } from "react";

const initialState = {
  activeGame: null,
  isPastGame: false,
  isLive: false,
};

function reducer(state, action){
  switch (action.type){
    case "SET_GAME":
      return {
        ...state,
        activeGame: action.payload,
        isPastGame: action.payload.isPastGame,
        isLive: action.payload.isLive,
      };
    default:
      return state;
  }
}

export default function NextGameSection({ game, countdown, prev, lastGame }){
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const activeGame = game || lastGame;
    if (!activeGame) return;

    const now = new Date();
    const isPastGame = !game && !!lastGame;
    const isLive =
      activeGame?.dateObj &&
      isWithinInterval(now, {
        start: subHours(activeGame.dateObj, 0.05),
        end: addHours(activeGame.dateObj, 2),
      });

    dispatch({
      type: "SET_GAME",
      payload: { ...activeGame, isPastGame, isLive },
    });
  }, [game, lastGame]);

  const { activeGame, isPastGame, isLive } = state;
  if (!activeGame) return null;

  const formatDate = (date) =>
    date?.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "America/Chicago",
    });

  const formatTime = (date) =>
    !date
      ? "TBD"
      : date.getHours() === 0 && date.getMinutes() === 0
      ? "TBD"
      : date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
          timeZone: "America/Chicago",
        });

  const renderCountdown = () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 justify-center mt-4 sm:mt-6">
      {["days", "hours", "minutes", "seconds"].map((unit) => {
        const changed = prev[unit] !== countdown[unit];
        return (
          <div
            key={unit}
            className={`bg-gray-100 text-black p-3 sm:p-4 rounded shadow text-center transition-transform duration-300 ${
              changed ? "scale-110" : ""
            }`}
          >
            <span className="block text-xl sm:text-3xl font-bold">
              {countdown[unit]}
            </span>
            <span className="text-xs sm:text-sm capitalize">{unit}</span>
          </div>
        );
      })}
    </div>
  );

  const renderFinalScore = () => {
    if (
      typeof activeGame.msuScore !== "number" ||
      typeof activeGame.oppScore !== "number"
    )
      return null;

    const result =
      activeGame.msuScore > activeGame.oppScore
        ? "W"
        : activeGame.msuScore < activeGame.oppScore
        ? "L"
        : "T";

    return (
      <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center text-center px-2">
        <div className="text-5xl sm:text-6xl font-extrabold tracking-wide text-gray-900">
          {activeGame.msuScore} - {activeGame.oppScore}
        </div>
        <div
          className={`mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold ${
            result === "W"
              ? "text-green-700"
              : result === "L"
              ? "text-red-700"
              : "text-gray-700"
          }`}
        >
          {result === "W" ? "WIN" : result === "L" ? "LOSS" : "TIE"}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full py-8 sm:py-10 px-4 sm:px-10 text-black text-center animate-fadeIn">
      {/* LIVE badge */}
      {isLive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#5E0009] text-white font-bold text-sm rounded-full animate-pulse shadow-md">
          🔴 LIVE NOW
        </div>
      )}

      {/* Opponent section */}
      <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 md:flex-row md:gap-10 mt-2">
        {activeGame.awayLogo && (
          <div className="h-24 w-24 sm:h-32 sm:w-32 md:h-44 md:w-44 flex-shrink-0">
            {activeGame.awayLink ? (
              <a
                href={activeGame.awayLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={activeGame.awayLogo}
                  alt="Opponent Logo"
                  className="h-full w-full object-contain"
                />
              </a>
            ) : (
              <img
                src={activeGame.awayLogo}
                alt="Opponent Logo"
                className="h-full w-full object-contain"
              />
            )}
          </div>
        )}
        <div className="text-2xl sm:text-4xl md:text-5xl font-bold leading-tight">
          {activeGame.opponent}
        </div>
      </div>

      {/* Countdown or Final Score */}
      {isPastGame ? renderFinalScore() : renderCountdown()}

      {/* Game details */}
      <div className="bg-gray-100 mt-6 sm:mt-8 p-4 sm:p-5 w-full text-center rounded-md">
        <div className="text-lg sm:text-2xl font-semibold mb-1">
          {formatDate(activeGame.dateObj)}
        </div>
        <div className="text-base sm:text-xl mb-2">
          {formatTime(activeGame.dateObj)}
        </div>
        <div className="text-sm sm:text-md">
          {activeGame.location && activeGame.location !== "TBD" ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                activeGame.location
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-[#5E0009] font-medium"
            >
              {activeGame.location}
            </a>
          ) : (
            <span>{activeGame.location || "TBD"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
