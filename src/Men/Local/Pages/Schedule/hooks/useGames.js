// src/Men/Local/Pages/Schedule/hooks/useGames.js
import { useEffect, useReducer } from "react";
import { db } from "../../Global/Services/firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { uploadHelper } from "../../Global/Common/hooks/uploadHelper.js";

const initialState = {
  games: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state, action){
  switch (action.type){
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

const normalizeSeason = (season, dateObj = null) => {
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
  if (/^\d{4}-\d{2}$/.test(season)){
    const [start, end] = season.split("-");
    return `${start.slice(-2)}-${end}`;
  }
  if (/^\d{4}$/.test(season)){
    const year = parseInt(season, 10);
    return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
  }
  return season;
};

export default function useGames(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { games, uploadProgress, loading, error } = state;

  const fetchGames = async () => {
    try {
      dispatch({ type: "SET_LOADING", value: true });
      const snapshot = await getDocs(collection(db, "games"));
      const data = snapshot.docs.map((docSnap) => {
        const game = docSnap.data();
        let dateObj = null;
        if (game.date?.toDate) dateObj = game.date.toDate();
        else if (typeof game.date === "string"){
          const parsed = Date.parse(game.date);
          if (!isNaN(parsed)) dateObj = new Date(parsed);
        }
        if (!dateObj) dateObj = new Date();
        if (dateObj && typeof game.time === "string" && game.time.trim() && game.time !== "TBD"){
          const match = game.time.trim().toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
          if (match){
            let [_, hour, minute = "0", ampm] = match;
            hour = parseInt(hour);
            minute = parseInt(minute);
            if (ampm === "pm" && hour < 12) hour += 12;
            if (ampm === "am" && hour === 12) hour = 0;
            dateObj.setHours(hour, minute, 0, 0);
          }
        } else dateObj.setHours(12, 0, 0, 0);
        const seasonStr = normalizeSeason(game.season, dateObj);
        const displayDate = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/Chicago",
        });
        return { id: docSnap.id, ...game, season: seasonStr, dateObj, displayDate };
      });
      const sorted = data.sort((a, b) => (a.dateObj || 0) - (b.dateObj || 0));
      dispatch({ type: "SET_GAMES", games: sorted });
      localStorage.setItem("games", JSON.stringify(sorted));
      return sorted;
    } catch (err){
      dispatch({ type: "SET_ERROR", error: err.message });
      return [];
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const saveGame = async (formData, editingId) => {
    try{
      const logoURL = await uploadHelper("teams", formData.awayLogo, (p) =>
        dispatch({ type: "SET_PROGRESS", value: p })
      );

      let dateValue = formData.date;
      if (typeof dateValue === "string"){
        const [year, month, day] = dateValue.split("-").map(Number);
        dateValue = new Date(year, month - 1, day);
      } else if (dateValue?.toDate) dateValue = dateValue.toDate();

      if (formData.time && formData.time.trim()){
        const t = formData.time.trim().toLowerCase();
        const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (match){
          let [_, hour, minute = "0", ampm] = match;
          hour = parseInt(hour);
          minute = parseInt(minute);
          if (ampm === "pm" && hour < 12) hour += 12;
          if (ampm === "am" && hour === 12) hour = 0;
          dateValue.setHours(hour, minute, 0, 0);
        }
      } else formData.time = "TBD";

      const gameData = {
        ...formData,
        date: Timestamp.fromDate(dateValue),
        awayLogo: logoURL,
        season: normalizeSeason(formData.season, dateValue),
      };

      if (editingId) await updateDoc(doc(db, "games", editingId), gameData);
      else await addDoc(collection(db, "games"), gameData);

      try{
        if (gameData.opponent && (gameData.awayLogo || gameData.awayLink)){
          const teamName = gameData.opponent.trim();
          const teamDocRef = doc(db, "teams", teamName);
          const teamData = {
            name: teamName,
            nameLower: teamName.toLowerCase(),
            logo: gameData.awayLogo || "",
            link: gameData.awayLink || "",
          };
          await updateDoc(teamDocRef, teamData).catch(async () => {
            await setDoc(teamDocRef, teamData);
          });
        }
      } catch (syncErr){
        console.warn("team sync error:", syncErr);
      }

      return await fetchGames(gameData.season);
    } catch (err){
      dispatch({ type: "SET_ERROR", error: err.message });
    } finally{
      dispatch({ type: "SET_PROGRESS", value: null });
    }
  };

  const removeGame = async (id) => {
    try {
      await deleteDoc(doc(db, "games", id));
      dispatch({ type: "REMOVE_GAME", id });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err.message });
    }
  };

  return { games, fetchGames, saveGame, removeGame, uploadProgress, loading, error };
}
