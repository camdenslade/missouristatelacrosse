// src/Men/Local/Pages/Schedule/Modals/Score.jsx
import { useReducer, useEffect } from "react";

const initialState = {
  msuScore: "",
  oppScore: "",
  notes: "",
  saving: false,
  error: "",
};

function reducer(state, action){
  switch (action.type){
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "LOAD_GAME":
      return {
        ...state,
        msuScore: action.game.msuScore ?? "",
        oppScore: action.game.oppScore ?? "",
        notes: action.game.notes ?? "",
        error: "",
      };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    default:
      return state;
  }
}

export default function ScoreModal({ isOpen, onClose, game, onSave }){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { msuScore, oppScore, notes, saving, error } = state;

  useEffect(() => {
    if (game) dispatch({ type: "LOAD_GAME", game });
  }, [game]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });

    if (msuScore === "" || oppScore === ""){
      dispatch({ type: "SET_ERROR", error: "Please enter both scores." });
      return;
    }

    const result =
      Number(msuScore) > Number(oppScore)
        ? "W"
        : Number(msuScore) < Number(oppScore)
        ? "L"
        : "T";

    try{
      dispatch({ type: "SET_SAVING", value: true });
      await onSave({
        ...game,
        msuScore: Number(msuScore),
        oppScore: Number(oppScore),
        result,
        notes,
      });
    } catch (err){
      console.error("Error saving game score:", err);
      dispatch({ type: "SET_ERROR", error: "Failed to save score. Please try again." });
    } finally{
      dispatch({ type: "SET_SAVING", value: false });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md animate-fadeIn">
        <h2 className="text-2xl font-bold mb-4 text-center text-[#5E0009]">
          Enter Game Score
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">
              Missouri State Score
            </label>
            <input
              type="number"
              value={msuScore}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "msuScore", value: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Opponent Score</label>
            <input
              type="number"
              value={oppScore}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "oppScore", value: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">
              Notes / Recap Link (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "notes", value: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-[#5E0009] focus:outline-none"
              rows="3"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center font-medium">{error}</p>
          )}

          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#5E0009] text-white hover:bg-red-800 rounded transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}