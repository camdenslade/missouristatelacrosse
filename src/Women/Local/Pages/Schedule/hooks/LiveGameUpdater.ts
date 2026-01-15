// src/Women/Local/Pages/Schedule/hooks/LiveGameUpdater.js
import { apiRequest } from "../../../../../Services/API";

export async function updateLiveGame(gameId, updates = {}){
  if (!gameId){
    console.error("Missing gameId for live update");
    return;
  }

  try{
    await apiRequest(`/api/games/${gameId}`, {
      method: "PUT",
      json: {
        data: {
          ...updates,
          lastUpdated: new Date().toISOString(),
        },
      },
    });
    console.log(`Game ${gameId} updated with:`, updates);
  } catch (error){
    console.error("Error updating live game:", error);
  }
}

