// src/Men/Local/Pages/Schedule/Live/LiveGameUI.jsx
import { useReducer } from "react";

import { updateLiveGame } from "../hooks/LiveGameUpdater.js";

const initialState = (game) => ({
  quarter: game.currentQuarter || "1",
  timeInQuarter: game.timeInQuarter || "15:00",
  homeScore: game.boxScore?.totalHome || 0,
  awayScore: game.boxScore?.totalAway || 0,
  playerStats: game.playerStats || [],
  saving: false,
});

function reducer(state, action){
  switch (action.type){
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "ADD_PLAYER":
      return {
        ...state,
        playerStats: [
          ...state.playerStats,
          { name: "", goals: 0, assists: 0, groundBalls: 0 },
        ],
      };
    case "UPDATE_PLAYER":
      const updated = [...state.playerStats];
      updated[action.index][action.field] =
        action.field === "name" ? action.value : Number(action.value);
      return { ...state, playerStats: updated };
    case "SAVE_START":
      return { ...state, saving: true };
    case "SAVE_SUCCESS":
    case "SAVE_ERROR":
      return { ...state, saving: false };
    default:
      return state;
  }
}

export default function LiveGameUI({ game }){
  const [state, dispatch] = useReducer(reducer, game, initialState);
  const { quarter, timeInQuarter, homeScore, awayScore, playerStats, saving } =
    state;

  const handleSave = async (markFinal = false) => {
    dispatch({ type: "SAVE_START" });
    try{
      await updateLiveGame(game.id, {
        status: markFinal ? "final" : "live",
        currentQuarter: quarter,
        timeInQuarter,
        boxScore: {
          totalHome: Number(homeScore),
          totalAway: Number(awayScore),
        },
        playerStats,
      });
      alert(markFinal ? "Game marked final!" : "Live update saved!");
      dispatch({ type: "SAVE_SUCCESS" });
    } catch (err){
      console.error("Error saving live data:", err);
      alert("Error saving data. Check console.");
      dispatch({ type: "SAVE_ERROR" });
    }
  };

  return (
    <div className="border border-[#5E0009] rounded-xl p-5 bg-white shadow-md mt-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-[#5E0009] mb-3">
        🏑 {game.opponent} — {game.status === "final" ? "FINAL" : "LIVE"}
      </h2>

      {/* Team Scores */}
      <div className="flex justify-between text-lg font-semibold mb-4">
        <label>
          Missouri State:{" "}
          <input
            type="number"
            value={homeScore}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "homeScore", value: e.target.value })
            }
            className="border rounded px-2 py-1 w-16 text-center"
          />
        </label>
        <label>
          {game.opponent}:{" "}
          <input
            type="number"
            value={awayScore}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "awayScore", value: e.target.value })
            }
            className="border rounded px-2 py-1 w-16 text-center"
          />
        </label>
      </div>

      {/* Quarter + Time Controls */}
      <div className="flex gap-6 mb-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Quarter</label>
          <select
            value={quarter}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "quarter", value: e.target.value })
            }
            className="border p-1 rounded w-20"
          >
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
            <option value="OT">OT</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Time Left</label>
          <input
            type="text"
            value={timeInQuarter}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "timeInQuarter",
                value: e.target.value,
              })
            }
            className="border p-1 rounded w-24 text-center"
            placeholder="12:00"
          />
        </div>
      </div>

      {/* Live Stream */}
      {game.liveLink && (
        <div className="mt-4">
          <iframe
            src={game.liveLink}
            title="Live Stream"
            allow="fullscreen"
            className="w-full h-64 rounded-lg border"
          ></iframe>
        </div>
      )}

      {/* Player Stats */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold text-[#5E0009]">Player Stats</h3>
          <button
            onClick={() => dispatch({ type: "ADD_PLAYER" })}
            className="bg-gray-200 px-2 py-1 text-sm rounded hover:bg-gray-300"
          >
            + Add Player
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-center">Goals</th>
                <th className="p-2 text-center">Assists</th>
                <th className="p-2 text-center">GBs</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((p, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">
                    <input
                      value={p.name}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_PLAYER",
                          index: i,
                          field: "name",
                          value: e.target.value,
                        })
                      }
                      className="border rounded px-2 py-1 w-full"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      value={p.goals}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_PLAYER",
                          index: i,
                          field: "goals",
                          value: e.target.value,
                        })
                      }
                      className="border rounded px-2 py-1 w-16 text-center"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      value={p.assists}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_PLAYER",
                          index: i,
                          field: "assists",
                          value: e.target.value,
                        })
                      }
                      className="border rounded px-2 py-1 w-16 text-center"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      value={p.groundBalls}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_PLAYER",
                          index: i,
                          field: "groundBalls",
                          value: e.target.value,
                        })
                      }
                      className="border rounded px-2 py-1 w-16 text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="bg-[#5E0009] text-white px-4 py-2 rounded hover:bg-red-800"
        >
          {saving ? "Saving..." : "Save Live Update"}
        </button>

        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Mark Final
        </button>
      </div>
    </div>
  );
}
