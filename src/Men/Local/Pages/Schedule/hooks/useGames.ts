// src/Men/Local/Pages/Schedule/hooks/useGames.js
import { useEffect, useReducer } from "react";

import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import { apiRequest } from "../../../../../Services/API";
import type { JsonValue } from "../../../../../types/api";
import type { ScheduleGame } from "../../../../../types/schedule";

type GamesState = {
  games: ScheduleGame[];
  uploadProgress: string | null;
  loading: boolean;
  error: string | null;
};

type GamesAction =
  | { type: "SET_GAMES"; games: ScheduleGame[] }
  | { type: "SET_PROGRESS"; value: string | null }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "REMOVE_GAME"; id: string };

const initialState: GamesState = {
  games: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state: GamesState, action: GamesAction): GamesState {
  switch (action.type) {
    case "SET_GAMES":
      return { ...state, games: action.games, loading: false };
    case "SET_PROGRESS":
      return { ...state, uploadProgress: action.value };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "REMOVE_GAME":
      return { ...state, games: state.games.filter((g) => g.id !== action.id) };
    default:
      return state;
  }
}

const getCurrentSeasonLabel = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const normalizeSeason = (season?: string | null, dateObj: Date | null = null) => {
  if (!season) {
    if (dateObj) {
      const y = dateObj.getFullYear();
      const m = dateObj.getMonth() + 1;
      const start = m >= 8 ? y : y - 1;
      return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
    }
    return getCurrentSeasonLabel();
  }
  if (/^\d{2}-\d{2}$/.test(season)) return season;
  if (/^\d{4}-\d{2}$/.test(season)) {
    const [start, end] = season.split("-");
    return `${start.slice(-2)}-${end}`;
  }
  if (/^\d{4}$/.test(season)) {
    const year = parseInt(season, 10);
    return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
  }
  return season;
};

const parseGameData = (game: ScheduleGame | null): Record<string, JsonValue> => {
  if (!game?.data) return {};
  if (typeof game.data === "string") {
    try {
      return JSON.parse(game.data) as Record<string, JsonValue>;
    } catch {
      return {};
    }
  }
  if (typeof game.data === "object") return game.data as Record<string, JsonValue>;
  return {};
};

const buildGameData = (source: Partial<Omit<ScheduleGame, "date" | "awayLogo">>) => {
  const base =
    source?.data && typeof source.data === "object"
      ? { ...(source.data as Record<string, JsonValue>) }
      : {};
  const data = { ...base };
  const set = (key: string, value: JsonValue | undefined) => {
    if (value !== undefined) data[key] = value;
  };
  set("type", source?.type);
  set("isConference", source?.isConference);
  set("isDivision", source?.isDivision);
  set("tournamentType", source?.tournamentType);
  set("msuScore", source?.msuScore);
  set("oppScore", source?.oppScore);
  set("result", source?.result);
  set("notes", source?.notes);
  set("status", source?.status);
  set("currentQuarter", source?.currentQuarter);
  set("timeInQuarter", source?.timeInQuarter);
  set("boxScore", source?.boxScore);
  set("playerStats", source?.playerStats);
  set("liveLink", source?.liveLink);
  set("stats", source?.stats);
  return data;
};

type SaveGameInput = Partial<Omit<ScheduleGame, "date" | "awayLogo">> & {
  awayLogo?: File | string | null;
  date?: string | Date | { toDate: () => Date } | null;
  time?: string | null;
};

export default function useGames() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { games, uploadProgress, loading, error } = state;

  const fetchGames = async (): Promise<ScheduleGame[]> => {
    try {
      dispatch({ type: "SET_LOADING", value: true });
      const data = await apiRequest<ScheduleGame[]>("/api/games");
      const mapped = data.map((game) => {
        const extra = parseGameData(game);
        const merged = { ...game, ...extra, data: extra };
        let dateObj: Date | null = null;
        if (typeof merged.date === "string") {
          const parsed = Date.parse(merged.date);
          if (!isNaN(parsed)) dateObj = new Date(parsed);
        }
        if (!dateObj) dateObj = new Date();
        if (
          dateObj &&
          typeof merged.time === "string" &&
          merged.time.trim() &&
          merged.time !== "TBD"
        ) {
          const match = merged.time
            .trim()
            .toLowerCase()
            .match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
          if (match) {
            let [_, hour, minute = "0", ampm] = match;
            let hourNum = parseInt(hour, 10);
            const minuteNum = parseInt(minute, 10);
            if (ampm === "pm" && hourNum < 12) hourNum += 12;
            if (ampm === "am" && hourNum === 12) hourNum = 0;
            dateObj.setHours(hourNum, minuteNum, 0, 0);
          }
        } else {
          dateObj.setHours(12, 0, 0, 0);
        }
        const seasonStr = normalizeSeason(merged.season || null, dateObj);
        const displayDate = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/Chicago",
        });
        return {
          ...merged,
          season: seasonStr,
          dateObj,
          displayDate,
        };
      });
      const sorted = mapped.sort(
        (a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0)
      );
      dispatch({ type: "SET_GAMES", games: sorted });
      localStorage.setItem("games", JSON.stringify(sorted));
      return sorted;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load games.";
      dispatch({ type: "SET_ERROR", error: message });
      return [];
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const saveGame = async (
    formData: SaveGameInput,
    editingId?: string
  ) => {
    try {
      const logoURL = await uploadCompressedImage(
        formData.awayLogo ?? null,
        { type: "logos" },
        (p) => dispatch({ type: "SET_PROGRESS", value: p })
      );

      let dateValue: Date | null = null;
      const dateInput = formData.date;
      if (dateInput && typeof dateInput === "object") {
        if (dateInput instanceof Date) {
          dateValue = dateInput;
        } else if ("toDate" in dateInput && typeof dateInput.toDate === "function") {
          dateValue = dateInput.toDate();
        }
      } else if (typeof dateInput === "string") {
        if (dateInput.includes("T")) {
          dateValue = new Date(dateInput);
        } else {
          const [year, month, day] = dateInput.split("-").map(Number);
          dateValue = new Date(year, month - 1, day);
        }
      }
      if (!dateValue) dateValue = new Date();

      if (formData.time && formData.time.trim()) {
        const t = formData.time.trim().toLowerCase();
        const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (match) {
          let [_, hour, minute = "0", ampm] = match;
          let hourNum = parseInt(hour, 10);
          const minuteNum = parseInt(minute, 10);
          if (ampm === "pm" && hourNum < 12) hourNum += 12;
          if (ampm === "am" && hourNum === 12) hourNum = 0;
          dateValue.setHours(hourNum, minuteNum, 0, 0);
        }
      } else {
        formData.time = "TBD";
      }

      const gameData: ScheduleGame = {
        opponent: formData.opponent,
        date: dateValue.toISOString(),
        time: formData.time || "TBD",
        location: formData.location,
        awayLogo: logoURL,
        awayLink: formData.awayLink,
        season: normalizeSeason(formData.season, dateValue),
        data: buildGameData(formData),
        id: editingId || "",
      };

      if (editingId) {
        await apiRequest(`/api/games/${editingId}`, {
          method: "PUT",
          json: gameData,
        });
      } else {
        await apiRequest(`/api/games`, {
          method: "POST",
          json: gameData,
        });
      }

      await fetchGames();
      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save game.";
      dispatch({ type: "SET_ERROR", error: message });
      return [];
    } finally {
      dispatch({ type: "SET_PROGRESS", value: null });
    }
  };

  const removeGame = async (id: string) => {
    try {
      await apiRequest(`/api/games/${id}`, { method: "DELETE" });
      dispatch({ type: "REMOVE_GAME", id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete game.";
      dispatch({ type: "SET_ERROR", error: message });
    }
  };

  return { games, fetchGames, saveGame, removeGame, uploadProgress, loading, error };
}
