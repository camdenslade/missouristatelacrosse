// src/Men/Local/Pages/Schedule/hooks/LiveGameUpdater.js
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../../../../Services/firebaseConfig.js";

export async function updateLiveGame(gameId, updates = {}){
  if (!gameId){
    console.error("Missing gameId for live update");
    return;
  }

  try{
    const gameRef = doc(db, "games", gameId);

    const payload = {
      ...updates,
      lastUpdated: serverTimestamp(),
    };

    await updateDoc(gameRef, payload);
    console.log(`Game ${gameId} updated with:`, updates);
  } catch (error){
    console.error("Error updating live game:", error);
  }
}