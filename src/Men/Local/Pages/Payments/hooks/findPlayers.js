// src/Men/Local/Pages/Payments/hooks/findPlayers.js
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { useState, useEffect } from "react";

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
  const userRole = roles?.men || "";

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchPlayers = async () => {
      setLoading(true);
      let list = [];

      try {
        if (userRole === "admin") {
          const snap = await getDocs(collection(db, "players"));
          list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((p) => p.season === currentSeason);
        } else if (userRole === "player") {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.playerId) {
              const playerRef = doc(db, "players", data.playerId);
              const playerSnap = await getDoc(playerRef);
              if (playerSnap.exists()) {
                const player = { id: playerSnap.id, ...playerSnap.data() };
                if (player.season === currentSeason) list = [player];
              }
            }
          }
        } else if (userRole === "parent") {
          if (parentProvidedLinkedPlayers.length > 0) {
            list = parentProvidedLinkedPlayers.filter(
              (p) => p.season === currentSeason
            );
          } else {
            const parentRef = doc(db, "parents", user.uid);
            const parentSnap = await getDoc(parentRef);
            if (parentSnap.exists()) {
              const ids = parentSnap.data().linkedPlayers || [];
              for (const pid of ids) {
                const pDoc = await getDoc(doc(db, "players", pid));
                if (pDoc.exists()) {
                  const player = { id: pDoc.id, ...pDoc.data() };
                  if (player.season === currentSeason) list.push(player);
                }
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
  }, [authLoading, user?.uid, userRole, parentProvidedLinkedPlayers.length, currentSeason]);

  return { players, setPlayers, loading };
}