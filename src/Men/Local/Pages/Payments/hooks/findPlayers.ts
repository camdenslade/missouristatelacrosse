import { useEffect, useState } from "react";

import { useAuth } from "../../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../../Services/API";
import type { ApiParentRecord, ApiPlayer, ApiUser, JsonValue, Program } from "../../../../../types/api";
import { fetchActiveSeasonCode, getSeasonValue } from "../../Roster/hooks/seasonUtils";

const parsePlayerData = (player: ApiPlayer | null): Record<string, JsonValue> => {
  if (!player?.data) return {};
  if (typeof player.data === "string"){
    try{
      return JSON.parse(player.data);
    } catch{
      return {};
    }
  }
  if (typeof player.data === "object") return player.data as Record<string, JsonValue>;
  return {};
};

export default function usePlayers(parentProvidedLinkedPlayers: ApiPlayer[] = []) {
  const { user, roles, loading: authLoading } = useAuth();
  const [players, setPlayers] = useState<ApiPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Falls back to the calendar-guess season until the real admin-managed active season
  // (which can be advanced/held independently of the Aug-1 cutoff — that's the whole point
  // of Manage Seasons) has loaded, so this hook doesn't filter every player out against a
  // season string the rest of the page has already moved past.
  const [currentSeason, setCurrentSeason] = useState(getSeasonValue());
  useEffect(() => {
    fetchActiveSeasonCode().then(setCurrentSeason).catch(() => {});
  }, []);

  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program: Program = isWomenSite ? "women" : "men";
  const userRole = roles?.[program] || "";

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchPlayers = async () => {
      setLoading(true);
      let list: ApiPlayer[] = [];

      try {
        if (userRole === "admin") {
          list = await apiRequest<ApiPlayer[]>(`/api/players`);
        } else if (userRole === "player") {
          const userRecord = await apiRequest<ApiUser>(`/api/users/${user.uid}`).catch(() => null);
          if (userRecord?.playerId) {
            const player = await apiRequest<ApiPlayer>(`/api/players/${userRecord.playerId}`).catch(() => null);
            if (player && player.season === currentSeason) list = [player];
          }
        } else if (userRole === "parent") {
          if (parentProvidedLinkedPlayers.length > 0) {
            list = parentProvidedLinkedPlayers.filter(
              (p) => p.season === currentSeason
            );
          } else {
            const parentRecord = await apiRequest<ApiParentRecord>(`/api/parents/${user.uid}`).catch(() => null);
            const ids = parentRecord?.linkedPlayers || [];
            for (const pid of ids) {
              const player = await apiRequest<ApiPlayer>(`/api/players/${pid}`).catch(() => null);
              if (player && player.season === currentSeason) list.push(player);
            }
          }
        }

        list = list.map((player) => {
          const extra = parsePlayerData(player);
          return { ...player, ...extra, data: extra, balance: player.balance ?? 0 };
        });

        setPlayers(list);
      } catch (err) {
        console.error("Error loading players:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [
    authLoading,
    user?.uid,
    userRole,
    parentProvidedLinkedPlayers.length,
    currentSeason,
  ]);

  return { players, setPlayers, loading };
}

