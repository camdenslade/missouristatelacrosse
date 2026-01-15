// src/Men/Local/Pages/Roster/contenthooks/usePlayers.js
import { useCallback, useReducer } from "react";

import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import { apiRequest } from "../../../../../Services/API";
import { formatSeason } from "../hooks/seasonUtils";
import type { Player, RosterFormData } from "../types";

type PlayerData = Record<string, string | null | undefined>;

type PlayerApi = Player & {
  data?: string | PlayerData | null;
};

type UsePlayersState = {
  players: Player[];
  uploadProgress: string | null;
  loading: boolean;
  error: string | null;
};

type PlayersAction =
  | { type: "SET_PLAYERS"; payload: Player[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PROGRESS"; payload: string | null }
  | { type: "ERROR"; payload: string };

const initialState: UsePlayersState = {
  players: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state: UsePlayersState, action: PlayersAction): UsePlayersState {
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

function parsePlayerData(player: PlayerApi | null | undefined): PlayerData {
  if (!player) return {};
  if (player.data && typeof player.data === "string"){
    try{
      return JSON.parse(player.data);
    } catch{
      return {};
    }
  }
  if (player.data && typeof player.data === "object") return player.data;
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
      const message = err instanceof Error ? err.message : "Failed to fetch players";
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
      const message = err instanceof Error ? err.message : "Failed to upload player photo";
      dispatch({ type: "ERROR", payload: message });
      return "";
    }
  }, []);

  const savePlayer = useCallback(
    async (formData: RosterFormData, editingId: string | null = null) => {
      try {
        const photoURL = await uploadPhoto(formData.photo, formData.season);
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
          season: formatSeason(formData.season),
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
        const message = err instanceof Error ? err.message : "Failed to save player";
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
      const message = err instanceof Error ? err.message : "Failed to delete player";
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
      const message = err instanceof Error ? err.message : "Failed to find player";
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

