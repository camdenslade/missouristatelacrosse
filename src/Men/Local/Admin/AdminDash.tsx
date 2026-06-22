// src/Men/Local/Admin/AdminDash.jsx
import { useMemo, useReducer } from "react";

import AccountRequests from "./Tabs/AccountRequests";
import EmailCenter from "./Tabs/EmailCenter";
import ManageCustomListings from "./Tabs/ManageCustomListings";
import ManageEvents from "./Tabs/ManageEvents";
import ManagePlayers from "./Tabs/ManagePlayers";
import ManageRaffles from "./Tabs/ManageRaffles";
import ManageSponsors from "./Tabs/ManageSponsors";
import StreamSetup from "./Tabs/StreamSetup";

const initialState = { activeTab: "players" };

function reducer(state, action){
  switch (action.type){
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    default:
      return state;
  }
}

export default function AdminDashboard(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { activeTab } = state;

  const tabs = useMemo(
    () => [
      { id: "players", label: "Manage Players" },
      { id: "requests", label: "Account Requests" },
      { id: "email", label: "Email Center" },
      { id: "sponsors", label: "Sponsors" },
      { id: "events", label: "Events" },
      { id: "raffles", label: "Raffles" },
      { id: "custom-listings", label: "Custom Listings" },
      { id: "stream", label: "Stream Setup" },
    ],
    []
  );

  const renderActiveTab = useMemo(() => {
    switch (activeTab){
      case "players":
        return <ManagePlayers />;
      case "requests":
        return <AccountRequests />;
      case "email":
        return <EmailCenter />;
      case "sponsors":
        return <ManageSponsors />;
      case "events":
        return <ManageEvents />;
      case "raffles":
        return <ManageRaffles />;
      case "custom-listings":
        return <ManageCustomListings />;
      case "stream":
        return <StreamSetup />;
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

