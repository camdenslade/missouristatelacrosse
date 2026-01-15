// src/Women/Local/Pages/Home/hooks/useArticles.js
import { useEffect, useState } from "react";

import { apiRequest } from "../../../../../Services/API";
import type { ApiArticle } from "../../../../../types/api";

export function useArticles(limitCount = 7){
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load(){
      try{
        const data = await apiRequest<ApiArticle[]>(
          `/api/articles?published=true&limit=${limitCount}`
        );
        if (!mounted) return;

        setArticles(data);
      } catch (err){
        console.error("Error fetching articles:", err);
      } finally{
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [limitCount]);

  return { articles, loading };
}

