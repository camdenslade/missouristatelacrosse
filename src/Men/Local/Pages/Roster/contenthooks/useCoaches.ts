// src/Men/Local/Pages/Roster/contenthooks/useCoaches.js
import { useCallback, useReducer } from "react";

import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import { apiRequest } from "../../../../../Services/API";
import { formatSeason } from "../hooks/seasonUtils";
import type { Coach, RosterFormData } from "../types";

type CoachData = {
  bio?: string;
};

type CoachApi = Coach & {
  data?: string | CoachData | null;
};

type UseCoachesState = {
  coaches: Coach[];
  uploadProgress: string | null;
  loading: boolean;
  error: string | null;
};

type CoachesAction =
  | { type: "SET_COACHES"; payload: Coach[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PROGRESS"; payload: string | null }
  | { type: "ERROR"; payload: string };

const initialState: UseCoachesState = {
  coaches: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state: UseCoachesState, action: CoachesAction): UseCoachesState {
  switch (action.type){
    case "SET_COACHES":
      return { ...state, coaches: action.payload, loading: false };
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

function parseCoachData(coach: CoachApi | null | undefined): CoachData {
  if (!coach) return {};
  if (coach.data && typeof coach.data === "string"){
    try{
      return JSON.parse(coach.data);
    } catch{
      return {};
    }
  }
  if (coach.data && typeof coach.data === "object") return coach.data;
  return {};
}

export default function useCoaches(){
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchCoaches = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try{
      const data = await apiRequest<CoachApi[]>("/api/coaches");
      const mapped = data.map((coach) => {
        const extra = parseCoachData(coach);
        return { ...coach, ...extra, data: extra };
      });

      const sorted = mapped.sort((a, b) => {
        if (a.position === "Head Coach") return -1;
        if (b.position === "Head Coach") return 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      dispatch({ type: "SET_COACHES", payload: sorted });
      return sorted;
    } catch (err){
      console.error("Error fetching coaches:", err);
      const message = err instanceof Error ? err.message : "Failed to fetch coaches";
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
        { type: "coaches", season: formatSeason(season) },
        (progress) => dispatch({ type: "SET_PROGRESS", payload: progress }),
        { compressionOptions: { maxWidthOrHeight: 512 } }
      );
    } catch (err){
      console.error("Error uploading coach photo:", err);
      const message = err instanceof Error ? err.message : "Failed to upload coach photo";
      dispatch({ type: "ERROR", payload: message });
      return "";
    }
  }, []);

  const saveCoach = useCallback(
    async (formData: RosterFormData, editingId: string | null = null) => {
      try{
        const photoURL = await uploadPhoto(formData.photo, formData.season);
        const coachData = {
          name: formData.name,
          position: formData.position,
          season: formatSeason(formData.season),
          photo: photoURL || (typeof formData.photo === "string" ? formData.photo : ""),
          data: {
            bio: formData.bio || "",
          },
        };

        if (editingId) {
          await apiRequest(`/api/coaches/${editingId}`, {
            method: "PUT",
            json: coachData,
          });
        } else {
          await apiRequest(`/api/coaches`, {
            method: "POST",
            json: coachData,
          });
        }

        return await fetchCoaches();
      } catch (err){
      console.error("Error saving coach:", err);
      const message = err instanceof Error ? err.message : "Failed to save coach";
      dispatch({ type: "ERROR", payload: message });
      }
    },
    [fetchCoaches, uploadPhoto]
  );

  const removeCoach = useCallback(
    async (id: string) => {
      try{
        await apiRequest(`/api/coaches/${id}`, { method: "DELETE" });
        dispatch({
          type: "SET_COACHES",
          payload: state.coaches.filter((c) => c.id !== id),
        });
      } catch (err){
        console.error("Error deleting coach:", err);
        const message = err instanceof Error ? err.message : "Failed to delete coach";
        dispatch({ type: "ERROR", payload: message });
      }
    },
    [state.coaches]
  );

  return {
    ...state,
    fetchCoaches,
    saveCoach,
    removeCoach,
    uploadPhoto,
  };
}

