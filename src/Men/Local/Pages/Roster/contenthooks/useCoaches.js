// src/Men/Local/Pages/Roster/contenthooks/useCoaches.js
import imageCompression from "browser-image-compression";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useCallback, useReducer } from "react";

import { db, storage } from "../../../../../Services/firebaseConfig.js";
import { formatSeason } from "../hooks/seasonUtils.js";

const initialState = {
  coaches: [],
  uploadProgress: null,
  loading: false,
  error: null,
};

function reducer(state, action){
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

export default function useCoaches(){
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchCoaches = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try{
      const snapshot = await getDocs(collection(db, "coaches"));
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        season: formatSeason(d.data().season),
      }));

      const sorted = data.sort((a, b) => {
        if (a.position === "Head Coach") return -1;
        if (b.position === "Head Coach") return 1;
        return a.name.localeCompare(b.name);
      });

      dispatch({ type: "SET_COACHES", payload: sorted });
      return sorted;
    } catch (err){
      console.error("Error fetching coaches:", err);
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

      const fileName = `coach-${crypto.randomUUID()}-${Date.now()}-${file.name}`;
      const storageRef = ref(storage, `coaches/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, compressed);

      return await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snap) => {
            const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
            dispatch({ type: "SET_PROGRESS", payload: progress.toFixed(0) });
          },
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            dispatch({ type: "SET_PROGRESS", payload: null });
            resolve(url);
          }
        );
      });
    } catch (err){
      console.error("Error uploading coach photo:", err);
      dispatch({ type: "ERROR", payload: err.message });
      return "";
    }
  }, []);

  const saveCoach = useCallback(
    async (formData, editingId = null) => {
      try{
        const photoURL = await uploadPhoto(formData.photo);
        const coachData = {
          ...formData,
          photo: photoURL,
          season: formatSeason(formData.season),
        };

        if (editingId) {
          await updateDoc(doc(db, "coaches", editingId), coachData);
        } else {
          await addDoc(collection(db, "coaches"), coachData);
        }

        return await fetchCoaches();
      } catch (err){
        console.error("Error saving coach:", err);
        dispatch({ type: "ERROR", payload: err.message });
      }
    },
    [fetchCoaches, uploadPhoto]
  );

  const removeCoach = useCallback(
    async (id) => {
      try{
        await deleteDoc(doc(db, "coaches", id));
        dispatch({
          type: "SET_COACHES",
          payload: state.coaches.filter((c) => c.id !== id),
        });
      } catch (err){
        console.error("Error deleting coach:", err);
        dispatch({ type: "ERROR", payload: err.message });
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
