// src/Women/Local/Pages/Schedule/Live/LiveGameViewer.jsx
import { useEffect, useReducer } from "react";

const initialState = (game) => ({
  opponent: game?.opponent || "Opponent",
  currentQuarter: game?.currentQuarter || 1,
  timeInQuarter: game?.timeInQuarter || "15:00",
  boxScore: {
    totalHome: game?.boxScore?.totalHome ?? 0,
    totalAway: game?.boxScore?.totalAway ?? 0,
  },
  playerStats: game?.playerStats || [],
  liveLink: game?.liveLink || "",
});

function reducer(state, action){
  switch (action.type){
    case "REFRESH_GAME":
      return {
        ...state,
        ...action.payload,
        boxScore: {
          totalHome: action.payload.boxScore?.totalHome ?? state.boxScore.totalHome,
          totalAway: action.payload.boxScore?.totalAway ?? state.boxScore.totalAway,
        },
      };
    default:
      return state;
  }
}

export default function LiveGameViewer({ game }){
  const [state, dispatch] = useReducer(reducer, game, initialState);
  const { opponent, currentQuarter, timeInQuarter, boxScore, playerStats, liveLink } =
    state;

  useEffect(() => {
    if (game) dispatch({ type: "REFRESH_GAME", payload: game });
  }, [game]);

  if (!game) return null;

  return (
    <div className="border border-[#5E0009] rounded-xl p-5 bg-white shadow-md mt-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-[#5E0009] mb-3 text-center">
        {opponent} — LIVE
      </h2>

      {/* Scoreboard */}
      <div className="flex justify-center gap-12 text-4xl font-extrabold mb-4">
        <div className="text-center">
          <div className="text-[#5E0009]">Missouri State</div>
          <div>{boxScore.totalHome}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-700">{opponent}</div>
          <div>{boxScore.totalAway}</div>
        </div>
      </div>

      {/* Quarter + Time */}
      <div className="text-center text-lg font-medium text-gray-700 mb-4">
        Q{currentQuarter} • {timeInQuarter}
      </div>

      {/* Live Stream */}
      {liveLink ? (
        <div className="mt-4">
          <iframe
            src={liveLink}
            title="Live Stream"
            allow="fullscreen"
            className="w-full h-64 rounded-lg border"
          ></iframe>
        </div>
      ) : (
        <div className="text-center text-gray-600 italic">
          No live stream available
        </div>
      )}

      {/* Inline Box Score / Stats */}
      {playerStats?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-[#5E0009] mb-2 text-center">
            Player Stats
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-center">G</th>
                  <th className="p-2 text-center">A</th>
                  <th className="p-2 text-center">GB</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p, i) => (
                  <tr key={i} className="border-b text-center">
                    <td className="p-2 text-left">{p.name}</td>
                    <td className="p-2">{p.goals}</td>
                    <td className="p-2">{p.assists}</td>
                    <td className="p-2">{p.groundBalls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}