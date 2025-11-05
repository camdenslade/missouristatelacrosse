// src/Men/Local/Pages/Roster/hooks/useRosterState.js
import { useReducer, useEffect } from "react";
import { getSeasonValue } from "./seasonUtils";

const initialState = {
  selectedSeason: "",
  showModal: false,
  editingItem: null,
  isCoach: false,
  loading: true,
};

function reducer(state, action){
  switch (action.type){
    case "SET_SEASON":
      return { ...state, selectedSeason: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "OPEN_MODAL":
      return { ...state, showModal: true, isCoach: action.isCoach, editingItem: action.item || null };
    case "CLOSE_MODAL":
      return { ...state, showModal: false, editingItem: null };
    default:
      return state;
  }
}

export default function useRosterState(seasonParam){
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const season = seasonParam || localStorage.getItem("selectedSeason") || getSeasonValue();
    dispatch({ type: "SET_SEASON", payload: season });
  }, [seasonParam]);

  return [state, dispatch];
}
