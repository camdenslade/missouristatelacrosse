// src/Men/Local/Pages/Roster/contenthooks/usePlayers.js
import { useReducer, useCallback } from "react";
import { db, storage } from "../../../Services/firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { formatSeason } from "../hooks/seasonUtils.js";

const initialState = {
  players: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state, action){
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

export default function usePlayers(){
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchPlayers = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try{
      const snapshot = await getDocs(collection(db, "players"));
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        season: formatSeason(d.data().season),
        balance: d.data().balance ?? 0,
      }));

      const sorted = data.sort(
        (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)
      );

      dispatch({ type: "SET_PLAYERS", payload: sorted });
      return sorted;
    } catch (err){
      console.error("Error fetching players:", err);
      dispatch({ type: "ERROR", payload: err.message });
      return [];
    }
  }, []);

  const uploadPhoto = useCallback(async (file) => {
    if (!file) return "";
    if (typeof file === "string") return file;

    try{
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const fileName = `player-${crypto.randomUUID()}-${Date.now()}-${file.name}`;
      const storageRef = ref(storage, `players/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, compressed);

      return await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snap) => {
            const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
            dispatch({ type: "SET_PROGRESS", payload: progress.toFixed(0) });
          },
          reject,
          async () =>{
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            dispatch({ type: "SET_PROGRESS", payload: null });
            resolve(url);
          }
        );
      });
    } catch (err){
      console.error("Error uploading photo:", err);
      dispatch({ type: "ERROR", payload: err.message });
      return "";
    }
  }, []);

  const savePlayer = useCallback(
    async (formData, editingId = null) => {
      try {
        const photoURL = await uploadPhoto(formData.photo);
        const player = {
          ...formData,
          photo: photoURL,
          season: formatSeason(formData.season),
          balance: formData.balance ?? 0,
        };

        if (editingId){
          await updateDoc(doc(db, "players", editingId), player);
        } else{
          await addDoc(collection(db, "players"), player);
        }

        return await fetchPlayers();
      } catch (err){
        console.error("Error saving player:", err);
        dispatch({ type: "ERROR", payload: err.message });
      }
    },
    [fetchPlayers, uploadPhoto]
  );

  const removePlayer = useCallback(async (id) => {
    try{
      await deleteDoc(doc(db, "players", id));
      dispatch({
        type: "SET_PLAYERS",
        payload: state.players.filter((p) => p.id !== id),
      });
    } catch (err){
      console.error("Error deleting player:", err);
      dispatch({ type: "ERROR", payload: err.message });
    }
  }, [state.players]);

  const findPlayerByName = useCallback(async (name) => {
    if (!name?.trim() || name.length < 2) return null;
    try{
      const lower = name.trim().toLowerCase();
      const snapshot = await getDocs(collection(db, "players"));
      const match = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((p) => p.name?.trim().toLowerCase() === lower);
      return match || null;
    } catch (err){
      console.error("Error finding player:", err);
      dispatch({ type: "ERROR", payload: err.message });
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
