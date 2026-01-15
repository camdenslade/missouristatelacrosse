// src/Men/Local/Pages/Schedule/Schedule.jsx
import { addHours, isWithinInterval, parseISO, subHours } from "date-fns";
import { useEffect, useReducer } from "react";
import type { ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentYear, setCurrentYear } from "../../../../Services/yearHelper";
import GameRow from "./components/GameRow";
import NextGameSection from "./components/HighlightGame";
import RecordGrid from "./components/RecordGrid";
import { calculateRecord } from "./hooks/recordUtils";
import useCountdown from "./hooks/useCountdown";
import useGames from "./hooks/useGames";
import LiveGameUI from "./Live/LiveGameUI";
import LiveGameViewer from "./Live/LiveGameViewer";
import ScheduleFormModal from "./Modals/ScheduleForm";
import ScoreModal from "./Modals/Score";
import type { ScheduleGame } from "../../../../types/schedule";

const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};
const generateSeasonValues = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentStart = m >= 8 ? y : y - 1;
  return Array.from({ length: 4 }, (_, i) =>
    `${String(currentStart - i).slice(-2)}-${String(currentStart - i + 1).slice(-2)}`
  );
};
const isGameLive = (g: ScheduleGame | null) => {
  if (!g?.date || !g?.time || g.time === "TBD") return false;
  try {
    const dt = parseISO(`${g.date}T${g.time}`);
    const now = new Date();
    return isWithinInterval(now, { start: subHours(dt, 0.1), end: addHours(dt, 2) });
  } catch {
    return false;
  }
};

type ScheduleState = {
  games: ScheduleGame[];
  selectedSeason: string;
  showFormModal: boolean;
  showScoreModal: boolean;
  editingGame: ScheduleGame | null;
  selectedGame: ScheduleGame | null;
  loading: boolean;
};

type ScheduleAction =
  | { type: "SET_GAMES"; games: ScheduleGame[] }
  | { type: "SET_SEASON"; season: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "TOGGLE_MODAL"; modal: "showFormModal" | "showScoreModal"; value: boolean }
  | { type: "EDIT_GAME"; game: ScheduleGame | null }
  | { type: "SELECT_GAME"; game: ScheduleGame | null };

const initialState: ScheduleState = {
  games: [],
  selectedSeason: localStorage.getItem("selectedSeason") || getSeasonValue(),
  showFormModal: false,
  showScoreModal: false,
  editingGame: null,
  selectedGame: null,
  loading: true,
};

function reducer(state: ScheduleState, action: ScheduleAction): ScheduleState {
  switch (action.type) {
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

export default function Schedule({ userRole }: { userRole?: string | null }) {
  const { season } = useParams();
  const navigate = useNavigate();
  const { fetchGames, saveGame, removeGame } = useGames();
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    games,
    selectedSeason,
    showFormModal,
    showScoreModal,
    editingGame,
    selectedGame,
    loading,
  } = state;

  useEffect(() => {
    const cachedYear = getCurrentYear();
    const current = getSeasonValue();
    if (!season) {
      navigate(`/schedule/${current}`, { replace: true });
      return;
    }
    if (season !== state.selectedSeason) {
      dispatch({ type: "SET_SEASON", season });
      setCurrentYear(season);
    }
  }, [season]);

  const loadSeason = async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    const allGames = await fetchGames();
    const filtered = allGames
      .filter((g) => g.season === selectedSeason)
      .sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
    localStorage.setItem("games", JSON.stringify(allGames));
    dispatch({ type: "SET_GAMES", games: filtered });
  };

  useEffect(() => {
    loadSeason();
  }, [selectedSeason]);

  useEffect(() => {
    if (!games.some(isGameLive)) return;
    const interval = setInterval(loadSeason, 30000);
    return () => clearInterval(interval);
  }, [games]);

  const record = calculateRecord(games);
  const now = new Date();
  const nextGame = games.find((g) => g.dateObj && g.dateObj > now) || null;
  const lastGame =
    [...games]
      .filter((g) => g.dateObj && g.dateObj <= now && g.result)
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))[0] || null;
  const { countdown, prev } = useCountdown(nextGame?.dateObj ?? null);
  const liveGame = games.find((g) => g.status === "live") || null;

  const handleSaveScore = async (updated: ScheduleGame) => {
    await saveGame(updated, updated.id);
    dispatch({
      type: "SET_GAMES",
      games: games.map((g) => (g.id === updated.id ? updated : g)),
    });
    dispatch({ type: "TOGGLE_MODAL", modal: "showScoreModal", value: false });
  };

  const handleSeasonChange = (val: string) => {
    dispatch({ type: "SET_SEASON", season: val });
    setCurrentYear(val);
    navigate(`/schedule/${val}`);
  };

  const availableSeasons = Array.from(
    new Set([...generateSeasonValues(), ...games.map((g) => g.season || "")])
  ).sort();

  const renderDivider = (label: string) => (
    <div className="flex items-center justify-center my-6">
      <div className="flex-grow border-t-2 border-[#5E0009]" />
      <span className="px-4 text-[#5E0009] font-semibold uppercase tracking-wide text-sm">
        {label}
      </span>
      <div className="flex-grow border-t-2 border-[#5E0009]" />
    </div>
  );

  const formatTournamentLabel = (type?: string | null) => {
    if (!type) return null;
    const map = {
      conference: "Conference Tournament",
      national: "National Tournament",
    };
    return map[type.toLowerCase()] || null;
  };

  return (
    <div className="max-w-full text-black relative">
      <div className="flex justify-between items-center px-6 mt-4">
        <select
          value={selectedSeason}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="border border-gray-400 px-3 py-1 rounded bg-white text-sm"
        >
          {availableSeasons.map((s) => (
            <option key={s} value={s}>
              {s} Season
            </option>
          ))}
        </select>
      </div>

      <RecordGrid record={record} loading={loading} />
      {!loading && (nextGame || lastGame) && (
        <NextGameSection
          game={nextGame}
          lastGame={lastGame}
          countdown={countdown}
          prev={prev}
        />
      )}

      {liveGame &&
        (userRole?.toLowerCase() === "admin" ? (
          <LiveGameUI game={liveGame} />
        ) : (
          <LiveGameViewer game={liveGame} />
        ))}

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
          (() => {
            const sections: ReactElement[] = [];
            let lastType = "regular";
            games.forEach((g, i) => {
              const tType = g.tournamentType?.toLowerCase() || "regular";
              if (tType !== lastType && tType !== "regular") {
                const label = formatTournamentLabel(tType);
                if (label) sections.push(renderDivider(label));
                lastType = tType;
              }
              sections.push(
                <GameRow
                  key={g.id}
                  game={g}
                  index={i}
                  isAdmin={userRole?.toLowerCase() === "admin"}
                  onEdit={(g) => dispatch({ type: "EDIT_GAME", game: g })}
                  onDelete={async (g) => {
                    if (confirm(`Delete ${g.opponent}?`)) {
                      await removeGame(g.id);
                      dispatch({
                        type: "SET_GAMES",
                        games: games.filter((x) => x.id !== g.id),
                      });
                    }
                  }}
                  onEnterScore={(g) =>
                    dispatch({ type: "SELECT_GAME", game: g })
                  }
                />
              );
            });
            return sections;
          })()
        ) : (
          <div className="text-center text-gray-500 py-10">
            No games found for {selectedSeason}.
          </div>
        )}
      </div>

      {showFormModal && (
        <ScheduleFormModal
          editingGame={editingGame}
          selectedSeason={selectedSeason}
          onClose={() =>
            dispatch({
              type: "TOGGLE_MODAL",
              modal: "showFormModal",
              value: false,
            })
          }
          onSave={async (data, id) => {
            await saveGame(data, id || undefined);
            dispatch({
              type: "TOGGLE_MODAL",
              modal: "showFormModal",
              value: false,
            });
            await loadSeason();
          }}
        />
      )}

      {showScoreModal && (
        <ScoreModal
          isOpen={showScoreModal}
          onClose={() =>
            dispatch({
              type: "TOGGLE_MODAL",
              modal: "showScoreModal",
              value: false,
            })
          }
          game={selectedGame}
          onSave={handleSaveScore}
        />
      )}
    </div>
  );
}

