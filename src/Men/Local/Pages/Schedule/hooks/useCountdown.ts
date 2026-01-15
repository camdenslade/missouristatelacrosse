// src/Men/Local/Pages/Schedule/hooks/useCountdown.js
import { useEffect, useReducer, useRef } from "react";

const initialState = {
  countdown: { days: 0, hours: 0, minutes: 0, seconds: 0 },
  prev: { days: 0, hours: 0, minutes: 0, seconds: 0 },
};

function reducer(state, action){
  switch (action.type){
    case "UPDATE":
      return { prev: state.countdown, countdown: action.value };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export default function useCountdown(targetDate: Date | null){
  const [state, dispatch] = useReducer(reducer, initialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetDate) {
      dispatch({ type: "RESET" });
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff > 0) {
        const newCountdown = {
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        };
        dispatch({ type: "UPDATE", value: newCountdown });
      } else {
        dispatch({ type: "RESET" });
      }
    };

    updateCountdown();
    intervalRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetDate]);

  return state;
}
