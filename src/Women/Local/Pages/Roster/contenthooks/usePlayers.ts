// src/Women/Local/Pages/Roster/contenthooks/usePlayers.js
import { useCallback, useReducer } from "react";

import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import { apiRequest } from "../../../../../Services/API";
import { formatSeason } from "../hooks/seasonUtils";
import type { JsonValue } from "../../../../../types/api";

type PlayerApi = {
  id: string;
  name?: string | null;
  email?: string | null;
  season?: string | null;
  number?: string | null;
  position?: string | null;
  classYear?: string | null;
  photo?: string | null;
  balance?: number | null;
  data?: Record<string, JsonValue> | string | null;
  height?: string | null;
  weight?: string | null;
  hometown?: string | null;
  state?: string | null;
  highSchool?: string | null;
  previousSchool?: string | null;
  bio?: string | null;
  userID?: string | null;
};

type PlayerForm = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  season?: string | null;
  number?: string | null;
  position?: string | null;
  classYear?: string | null;
  photo?: File | string | null;
  balance?: number | null;
  height?: string | null;
  weight?: string | null;
  hometown?: string | null;
  state?: string | null;
  highSchool?: string | null;
  previousSchool?: string | null;
  bio?: string | null;
  userID?: string | null;
};

type PlayersState = {
  players: PlayerApi[];
  uploadProgress: string | null;
  loading: boolean;
  error: string | null;
};

type PlayersAction =
  | { type: "SET_PLAYERS"; payload: PlayerApi[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PROGRESS"; payload: string | null }
  | { type: "ERROR"; payload: string };

const initialState: PlayersState = {
  players: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state: PlayersState, action: PlayersAction): PlayersState {
  switch (action.type){
    case "SET_PLAYERS":
      return { ...state, players: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_PROGRESS":
      return { ...state, uploadProgress: action.payload };
    case "ERROR":
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

function parsePlayerData(player: PlayerApi | null): Record<string, JsonValue> {
  if (!player) return {};
  if (player.data && typeof player.data === "string"){
    try{
      return JSON.parse(player.data) as Record<string, JsonValue>;
    } catch{
      return {};
    }
  }
  if (player.data && typeof player.data === "object") return player.data as Record<string, JsonValue>;
  return {};
}

export default function usePlayers(){
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchPlayers = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try{
      const data = await apiRequest<PlayerApi[]>("/api/players");
      const mapped = data.map((player) => {
        const extra = parsePlayerData(player);
        return {
          ...player,
          ...extra,
          data: extra,
          balance: player.balance ?? 0,
        };
      });

      const sorted = mapped.sort(
        (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)
      );

      dispatch({ type: "SET_PLAYERS", payload: sorted });
      return sorted;
    } catch (err){
      console.error("Error fetching players:", err);
      const message = err instanceof Error ? err.message : "Failed to fetch players.";
      dispatch({ type: "ERROR", payload: message });
      return [];
    }
  }, []);

  const uploadPhoto = useCallback(async (file: File | string | null, season: string) => {
    if (!file) return "";
    if (typeof file === "string") return file;

    try{
      return await uploadCompressedImage(
        file,
        { type: "players", season: formatSeason(season) },
        (progress) => dispatch({ type: "SET_PROGRESS", payload: progress }),
        { compressionOptions: { maxWidthOrHeight: 512 } }
      );
    } catch (err){
      console.error("Error uploading photo:", err);
      const message = err instanceof Error ? err.message : "Failed to upload photo.";
      dispatch({ type: "ERROR", payload: message });
      return "";
    }
  }, []);

  const savePlayer = useCallback(
    async (formData: PlayerForm, editingId: string | null = null) => {
      try {
        const seasonValue = formData.season ? formatSeason(formData.season) : "";
        const photoURL = await uploadPhoto(formData.photo ?? null, seasonValue);
        const data = {
          height: formData.height || "",
          weight: formData.weight || "",
          hometown: formData.hometown || "",
          state: formData.state || "",
          highSchool: formData.highSchool || "",
          previousSchool: formData.previousSchool || "",
          bio: formData.bio || "",
          userID: formData.userID || "",
        };

        const player = {
          name: formData.name,
          email: formData.email,
          season: seasonValue,
          number: formData.number,
          position: formData.position,
          classYear: formData.classYear,
          photo: photoURL || (typeof formData.photo === "string" ? formData.photo : ""),
          balance: formData.balance ?? 0,
          data,
        };

        if (editingId){
          await apiRequest(`/api/players/${editingId}`, {
            method: "PUT",
            json: player,
          });
        } else{
          await apiRequest(`/api/players`, {
            method: "POST",
            json: player,
          });
        }

        return await fetchPlayers();
      } catch (err){
        console.error("Error saving player:", err);
        const message = err instanceof Error ? err.message : "Failed to save player.";
        dispatch({ type: "ERROR", payload: message });
      }
    },
    [fetchPlayers, uploadPhoto]
  );

  const removePlayer = useCallback(async (id: string) => {
    try{
      await apiRequest(`/api/players/${id}`, { method: "DELETE" });
      dispatch({
        type: "SET_PLAYERS",
        payload: state.players.filter((p) => p.id !== id),
      });
    } catch (err){
      console.error("Error deleting player:", err);
      const message = err instanceof Error ? err.message : "Failed to delete player.";
      dispatch({ type: "ERROR", payload: message });
    }
  }, [state.players]);

  const findPlayerByName = useCallback(async (name: string) => {
    if (!name?.trim() || name.length < 2) return null;
    try{
      const player = await apiRequest<PlayerApi>(
        `/api/players/search?name=${encodeURIComponent(name.trim())}`
      );
      if (!player?.id) return null;
      const extra = parsePlayerData(player);
      return { ...player, ...extra, data: extra };
    } catch (err){
      console.error("Error finding player:", err);
      const message = err instanceof Error ? err.message : "Failed to find player.";
      dispatch({ type: "ERROR", payload: message });
      return null;
    }
  }, []);

  return {
    ...state,
    fetchPlayers,
    savePlayer,
    removePlayer,
    uploadPhoto,
    findPlayerByName,
  };
}

