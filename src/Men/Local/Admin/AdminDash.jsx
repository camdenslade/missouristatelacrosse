// src/Men/Local/Admin/AdminDash.jsx
import { useReducer, useMemo } from "react";

import AccountRequests from "./Tabs/AccountRequests.jsx";
import EmailCenter from "./Tabs/EmailCenter.jsx";
import ManagePlayers from "./Tabs/ManagePlayers.jsx";

const initialState = { activeTab: "players" };

function reducer(state, action){
  switch (action.type){
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    default:
      return state;
  }
}

export default function AdminDash(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { activeTab } = state;

  const tabs = useMemo(
    () => [
      { id: "players", label: "Manage Players" },
      { id: "requests", label: "Account Requests" },
      { id: "email", label: "Email Center" },
    ],
    []
  );

  const renderActiveTab = useMemo(() => {
    switch (activeTab){
      case "players":
        return <ManagePlayers isOpen={true} onClose={() => {}} />;
      case "requests":
        return <AccountRequests />;
      case "email":
        return <EmailCenter />;
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <div className="max-w-6xl mx-auto mt-8 bg-white shadow rounded p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Admin Dashboard</h1>

      {/* Tab controls */}
      <div className="flex justify-center gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
            className={`px-4 py-2 rounded transition-all ${
              activeTab === tab.id
                ? "bg-gray-900 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fadeIn">{renderActiveTab}</div>
    </div>
  );
}
