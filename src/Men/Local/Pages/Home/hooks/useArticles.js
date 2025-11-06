// src/Men/Local/Pages/Home/hooks/useArticles.js
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useState, useEffect } from "react";

import { db } from "../../../../../Services/firebaseConfig.js";

export function useArticles(limitCount = 7){
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load(){
      try{
        const q = query(
          collection(db, "articles"),
          where("published", "==", true),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
        const snap = await getDocs(q);
        if (!mounted) return;

        const results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setArticles(results);
      } catch (err){
        console.error("Error fetching articles:", err);
      } finally{
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => (mounted = false);
  }, [limitCount]);

  return { articles, loading };
}
