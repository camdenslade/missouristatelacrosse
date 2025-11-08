// src/Women/Local/Pages/Schedule/components/RecordGrid.jsx
import { useEffect, useReducer } from "react";

const initialState = {
  record: {
    overall: "-",
    pct: "-",
    conf: "-",
    confPct: "-",
    div: "-",
    home: "-",
    away: "-",
    neutral: "-",
  },
  loading: true,
};

function reducer(state, action){
  switch (action.type){
    case "SET_RECORD":
      return { ...state, record: action.record, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

export default function RecordGrid({ record: externalRecord, loading: externalLoading }){
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (externalLoading !== undefined){
      dispatch({ type: "SET_LOADING", loading: externalLoading });
    }
    if (externalRecord){
      dispatch({ type: "SET_RECORD", record: externalRecord });
    }
  }, [externalRecord, externalLoading]);

  const { record, loading } = state;

  const items = [
    { label: "Overall", value: record.overall },
    { label: "Pct", value: record.pct },
    { label: "Conf", value: record.conf },
    { label: "Conf Pct", value: record.confPct },
    { label: "Div", value: record.div },
    { label: "Home", value: record.home },
    { label: "Away", value: record.away },
    { label: "Neutral", value: record.neutral },
  ];

  if (loading){
    return (
      <div className="max-w-6xl mx-auto grid grid-cols-4 md:grid-cols-8 gap-3 animate-pulse p-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full text-black overflow-x-auto transition-opacity duration-500 ease-in">
      <div
        className="
          max-w-6xl mx-auto 
          grid grid-cols-4 md:grid-cols-8 
          divide-x divide-y md:divide-y-0 divide-gray-400 
          border border-gray-400 text-center
        "
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className="py-3 hover:bg-[#5E000915] transition-colors duration-200"
          >
            <div className="text-xs md:text-sm font-semibold text-gray-600 uppercase tracking-wide">
              {item.label}
            </div>
            <div className="text-xl md:text-2xl font-bold text-[#5E0009]">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
