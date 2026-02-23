import { useCallback, useEffect, useReducer } from "react";
import { apiRequest } from "../../../Services/API";
import type { ApiSponsor } from "../../../types/api";
import { uploadCompressedImage } from "./uploadHelper";

type SponsorsState = {
  sponsors: ApiSponsor[];
  loading: boolean;
  uploadProgress: string | null;
};

type SponsorsAction =
  | { type: "SET_SPONSORS"; sponsors: ApiSponsor[] }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_PROGRESS"; value: string | null };

function reducer(state: SponsorsState, action: SponsorsAction): SponsorsState {
  switch (action.type) {
    case "SET_SPONSORS":
      return { ...state, sponsors: action.sponsors, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_PROGRESS":
      return { ...state, uploadProgress: action.value };
    default:
      return state;
  }
}

export function useSponsors() {
  const [state, dispatch] = useReducer(reducer, {
    sponsors: [],
    loading: true,
    uploadProgress: null,
  });

  const fetchSponsors = useCallback(async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      const data = await apiRequest<ApiSponsor[]>("/api/sponsors");
      const sorted = [...data].sort(
        (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)
      );
      dispatch({ type: "SET_SPONSORS", sponsors: sorted });
    } catch {
      dispatch({ type: "SET_SPONSORS", sponsors: [] });
    }
  }, []);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  const addSponsor = async (
    name: string,
    link: string,
    logoFile: File | string | null
  ) => {
    const logoKey = await uploadCompressedImage(
      logoFile,
      "sponsors",
      (p) => dispatch({ type: "SET_PROGRESS", value: p })
    );
    dispatch({ type: "SET_PROGRESS", value: null });

    const maxOrder = state.sponsors.reduce(
      (max, s) => Math.max(max, s.displayOrder ?? 0),
      0
    );

    await apiRequest("/api/sponsors", {
      method: "POST",
      json: { name, link, logo: logoKey, displayOrder: maxOrder + 1 },
    });
    await fetchSponsors();
  };

  const updateSponsor = async (
    id: string,
    name: string,
    link: string,
    logoFile: File | string | null
  ) => {
    const logoKey = await uploadCompressedImage(
      logoFile,
      "sponsors",
      (p) => dispatch({ type: "SET_PROGRESS", value: p })
    );
    dispatch({ type: "SET_PROGRESS", value: null });

    await apiRequest(`/api/sponsors/${id}`, {
      method: "PUT",
      json: { name, link, logo: logoKey },
    });
    await fetchSponsors();
  };

  const removeSponsor = async (id: string) => {
    await apiRequest(`/api/sponsors/${id}`, { method: "DELETE" });
    await fetchSponsors();
  };

  const moveSponsor = async (id: string, direction: "up" | "down") => {
    const idx = state.sponsors.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= state.sponsors.length) return;

    const current = state.sponsors[idx];
    const swap = state.sponsors[swapIdx];

    await Promise.all([
      apiRequest(`/api/sponsors/${current.id}`, {
        method: "PUT",
        json: { displayOrder: swap.displayOrder ?? swapIdx },
      }),
      apiRequest(`/api/sponsors/${swap.id}`, {
        method: "PUT",
        json: { displayOrder: current.displayOrder ?? idx },
      }),
    ]);
    await fetchSponsors();
  };

  return {
    sponsors: state.sponsors,
    loading: state.loading,
    uploadProgress: state.uploadProgress,
    addSponsor,
    updateSponsor,
    removeSponsor,
    moveSponsor,
    refetch: fetchSponsors,
  };
}
