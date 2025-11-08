// src/Women/Local/Pages/Payments/hooks/findPlayers.js
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../../../../../Global/Context/AuthContext.jsx";
import { db } from "../../../../../Services/firebaseConfig.js";

const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

export default function usePlayers(parentProvidedLinkedPlayers = []) {
  const { user, roles, loading: authLoading } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentSeason = getSeasonValue();
  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program = isWomenSite ? "women" : "men";
  const playersCollection = isWomenSite ? "playersw" : "players";
  const parentsCollection = isWomenSite ? "parentsw" : "parents";
  const userRole = roles?.[program] || "";

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchPlayers = async () => {
      setLoading(true);
      let list = [];

      try {
        if (userRole === "admin") {
          const snap = await getDocs(collection(db, playersCollection));
          list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((p) => p.season === currentSeason);
        }

        else if (userRole === "player") {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const linkedId = userSnap.data()?.playerId || "";

            if (!linkedId) {
              list = [];
            } else {
              const playerRef = doc(db, playersCollection, linkedId);
              const playerSnap = await getDoc(playerRef);

              if (playerSnap.exists()) {
                const player = { id: playerSnap.id, ...playerSnap.data() };

                if (player.season === currentSeason) {
                  list = [player];
                }
              }
            }
          }
        }

        else if (userRole === "parent") {
          const parentRef = doc(db, parentsCollection, user.uid);
          const parentSnap = await getDoc(parentRef);

          if (parentSnap.exists()) {
            const ids = parentSnap.data()?.linkedPlayers || [];

            for (const pid of ids) {
              const pSnap = await getDoc(doc(db, playersCollection, pid));
              if (pSnap.exists()) {
                const p = { id: pSnap.id, ...pSnap.data() };
                if (p.season === currentSeason) list.push(p);
              }
            }
          }
        }

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
    currentSeason,
    playersCollection,
    parentsCollection,
  ]);

  return { players, setPlayers, loading };
}
