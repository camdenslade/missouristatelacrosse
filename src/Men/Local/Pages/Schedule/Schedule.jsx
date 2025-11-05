// src/Men/Local/Pages/Schedule/Schedule.jsx
import { useReducer, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { isWithinInterval, addHours, subHours, parseISO } from "date-fns";
import useGames from "./hooks/useGame.js";
import useCountdown from "./hooks/useCountdown.js";
import GameRow from "./components/GameRow.jsx";
import RecordGrid from "./components/RecordGrid.jsx";
import NextGameSection from "./components/HighlightGame.jsx";
import LiveGameUI from "./components/LiveGameUI.jsx";
import LiveGameViewer from "./components/LiveGameViewer.jsx";
import ScheduleFormModal from "./Modals/ScheduleForm.jsx";
import ScoreModal from "./Modals/ScoreModal.jsx";
import { calculateRecord } from "./hooks/recordUtils.js";

const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};
const displaySeasonLabel = (shortCode) => `20${shortCode.slice(0,2)}-20${shortCode.slice(3,5)}`;
const generateSeasonValues = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentStart = m >= 8 ? y : y - 1;
  return Array.from({ length: 4 }, (_, i) => `${String(currentStart - i).slice(-2)}-${String(currentStart - i + 1).slice(-2)}`);
};
const isGameLive = (g) => {
  if (!g?.date || !g?.time || g.time === "TBD") return false;
  try{
    const dt = parseISO(`${g.date}T${g.time}`);
    const now = new Date();
    return isWithinInterval(now, { start: subHours(dt, 0.1), end: addHours(dt, 2) });
  } catch{
    return false;
  }
};

const initialState = {
  games: [],
  selectedSeason: localStorage.getItem("selectedSeason") || getSeasonValue(),
  showFormModal: false,
  showScoreModal: false,
  editingGame: null,
  selectedGame: null,
  loading: true,
};

function reducer(state, action){
  switch (action.type){
    case "SET_GAMES":
      return { ...state, games: action.games, loading: false };
    case "SET_SEASON":
      localStorage.setItem("selectedSeason", action.season);
      return { ...state, selectedSeason: action.season };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "TOGGLE_MODAL":
      return { ...state, [action.modal]: action.value };
    case "EDIT_GAME":
      return { ...state, editingGame: action.game, showFormModal: true };
    case "SELECT_GAME":
      return { ...state, selectedGame: action.game, showScoreModal: true };
    default:
      return state;
  }
}

export default function Schedule({ userRole }){
  const { season } = useParams();
  const navigate = useNavigate();
  const { fetchGames, saveGame, removeGame } = useGames();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { games, selectedSeason, showFormModal, showScoreModal, editingGame, selectedGame, loading } = state;

  const loadSeason = async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    const allGames = await fetchGames();
    const filtered = allGames.filter((g) => g.season === selectedSeason)
      .sort((a, b) => new Date(a.dateObj) - new Date(b.dateObj));
    localStorage.setItem("games", JSON.stringify(allGames));
    dispatch({ type: "SET_GAMES", games: filtered });
  };

  useEffect(() => { loadSeason(); }, [selectedSeason]);

  useEffect(() => {
    if (!games.some(isGameLive)) return;
    const interval = setInterval(loadSeason, 30000);
    return () => clearInterval(interval);
  }, [games]);

  const record = calculateRecord(games);
  const now = new Date();
  const nextGame = games.find((g) => g.dateObj && g.dateObj > now) || null;
  const lastGame = [...games].filter((g) => g.dateObj && g.dateObj <= now && g.result)
    .sort((a, b) => new Date(b.dateObj) - new Date(a.dateObj))[0] || null;
  const { countdown, prev } = useCountdown(nextGame?.dateObj);

  const liveGame = games.find((g) => g.status === "live") || null;

  const handleSaveScore = async (updated) => {
    await saveGame(updated, updated.id);
    dispatch({
      type: "SET_GAMES",
      games: games.map((g) => (g.id === updated.id ? updated : g)),
    });
    dispatch({ type: "TOGGLE_MODAL", modal: "showScoreModal", value: false });
  };

  const handleSeasonChange = (val) => {
    dispatch({ type: "SET_SEASON", season: val });
    navigate(`/schedule/${displaySeasonLabel(val)}`);
  };

  const availableSeasons = Array.from(
    new Set([...generateSeasonValues(), ...games.map((g) => g.season || "")])
  ).sort();

  return (
    <div className="max-w-full text-black relative">
      <div className="flex justify-between items-center px-6 mt-4">
        <select
          value={selectedSeason}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="border border-gray-400 px-3 py-1 rounded bg-white text-sm"
        >
          {availableSeasons.map((s) => (
            <option key={s} value={s}>{displaySeasonLabel(s)} Season</option>
          ))}
        </select>
      </div>

      <RecordGrid record={record} loading={loading} />
      {!loading && (nextGame || lastGame) && (
        <NextGameSection game={nextGame} lastGame={lastGame} countdown={countdown} prev={prev} />
      )}

      {liveGame && (
        userRole?.toLowerCase() === "admin" ? (
          <LiveGameUI game={liveGame} />
        ) : (
          <LiveGameViewer game={liveGame} />
        )
      )}

      <div className="w-full h-3 bg-[#5E0009]" />

      {userRole?.toLowerCase() === "admin" && (
        <div className="flex justify-center my-10">
          <button
            onClick={() => dispatch({ type: "EDIT_GAME", game: null })}
            className="px-6 py-3 bg-[#5E0009] text-white hover:bg-red-800 text-lg"
          >
            Add Game
          </button>
        </div>
      )}

      <div className="px-4 sm:px-10 mb-10">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : games.length ? (
          games.map((g, i) => (
            <GameRow
              key={g.id}
              game={g}
              index={i}
              isAdmin={userRole?.toLowerCase() === "admin"}
              onEdit={(g) => dispatch({ type: "EDIT_GAME", game: g })}
              onDelete={async (g) => {
                if (confirm(`Delete ${g.opponent}?`)) {
                  await removeGame(g.id);
                  dispatch({ type: "SET_GAMES", games: games.filter((x) => x.id !== g.id) });
                }
              }}
              onEnterScore={(g) => dispatch({ type: "SELECT_GAME", game: g })}
            />
          ))
        ) : (
          <div className="text-center text-gray-500 py-10">
            No games found for {displaySeasonLabel(selectedSeason)}.
          </div>
        )}
      </div>

      {showFormModal && (
        <ScheduleFormModal
          editingGame={editingGame}
          selectedSeason={selectedSeason}
          onClose={() => dispatch({ type: "TOGGLE_MODAL", modal: "showFormModal", value: false })}
          onSave={async (data, id) => {
            await saveGame(data, id);
            dispatch({ type: "TOGGLE_MODAL", modal: "showFormModal", value: false });
            await loadSeason();
          }}
        />
      )}

      {showScoreModal && (
        <ScoreModal
          isOpen={showScoreModal}
          onClose={() => dispatch({ type: "TOGGLE_MODAL", modal: "showScoreModal", value: false })}
          game={selectedGame}
          onSave={handleSaveScore}
        />
      )}
    </div>
  );
}
