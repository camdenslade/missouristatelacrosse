import { useEffect, useMemo, useReducer } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentYear, setCurrentYear } from "../../../../Services/yearHelper";
import useGames from "../Schedule/hooks/useGames";
import usePlayers from "../Roster/contenthooks/usePlayers";
import useSeasonStats from "./hooks/useSeasonStats";
import FieldStatsTable from "./components/FieldStatsTable";
import GoalieStatsTable from "./components/GoalieStatsTable";

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

type State = {
  selectedSeason: string;
  loading: boolean;
};

type Action =
  | { type: "SET_SEASON"; season: string }
  | { type: "SET_LOADING"; loading: boolean };

const initialState: State = {
  selectedSeason: localStorage.getItem("selectedSeason") || getSeasonValue(),
  loading: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SEASON":
      localStorage.setItem("selectedSeason", action.season);
      return { ...state, selectedSeason: action.season };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

export default function Stats() {
  const { season } = useParams();
  const navigate = useNavigate();
  const { games, fetchGames, loading: gamesLoading } = useGames();
  const { players, fetchPlayers } = usePlayers();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { selectedSeason, loading } = state;

  useEffect(() => {
    const current = getSeasonValue();
    if (!season) {
      navigate(`/stats/${current}`, { replace: true });
      return;
    }
    if (season !== state.selectedSeason) {
      dispatch({ type: "SET_SEASON", season });
      setCurrentYear(season);
    }
  }, [season]);

  useEffect(() => {
    dispatch({ type: "SET_LOADING", loading: true });
    Promise.all([fetchGames(), fetchPlayers()]).then(() =>
      dispatch({ type: "SET_LOADING", loading: false })
    );
  }, [selectedSeason]);

  const seasonGames = games.filter((g) => g.season === selectedSeason);
  const { fieldStats: rawFieldStats, goalieStats: rawGoalieStats } = useSeasonStats(seasonGames);

  // Build name→number lookup from roster to fill in numbers for older stats
  const numberMap = useMemo(() => {
    const map = new Map<string, string | number>();
    for (const p of players.filter((p) => p.season === selectedSeason)) {
      if (p.name && p.number != null) map.set(p.name.toLowerCase(), p.number);
    }
    return map;
  }, [players, selectedSeason]);

  const fieldStats = useMemo(
    () => rawFieldStats.map((s) => ({
      ...s,
      number: s.number ?? numberMap.get(s.name.toLowerCase()) ?? null,
    })),
    [rawFieldStats, numberMap]
  );

  const goalieStats = useMemo(
    () => rawGoalieStats.map((s) => ({
      ...s,
      number: s.number ?? numberMap.get(s.name.toLowerCase()) ?? null,
    })),
    [rawGoalieStats, numberMap]
  );

  const handleSeasonChange = (val: string) => {
    dispatch({ type: "SET_SEASON", season: val });
    setCurrentYear(val);
    navigate(`/stats/${val}`);
  };

  const availableSeasons = Array.from(
    new Set([...generateSeasonValues(), ...games.map((g) => g.season || "")])
  ).sort();

  const isLoading = loading || gamesLoading;

  return (
    <div className="max-w-6xl mx-auto text-black px-4 py-6">
      <div className="flex justify-between items-center px-2 mb-6">
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

      <h1 className="text-3xl font-bold text-center text-[#5E0009] mb-8">
        {selectedSeason} Season Stats
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-10 h-10 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-10 px-2">
          <div>
            <h2 className="text-2xl font-bold text-[#5E0009] mb-4">Field Players</h2>
            <FieldStatsTable stats={fieldStats} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[#5E0009] mb-4">Goalies</h2>
            <GoalieStatsTable stats={goalieStats} />
          </div>
        </div>
      )}
    </div>
  );
}
