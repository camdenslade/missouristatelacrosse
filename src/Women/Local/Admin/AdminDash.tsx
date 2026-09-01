import { useMemo, useReducer } from "react";

import AccountRequests from "./Tabs/AccountRequests";
import EmailCenter from "./Tabs/EmailCenter";
import ManageEvents from "./Tabs/ManageEvents";
import ManageFundraisers from "./Tabs/ManageFundraisers";
import ManagePlayers from "./Tabs/ManagePlayers";
import ManageRaffles from "./Tabs/ManageRaffles";
import ManageSponsors from "./Tabs/ManageSponsors";
import StreamSetup from "./Tabs/StreamSetup";
import ManageCustomListings from "../../../Men/Local/Admin/Tabs/ManageCustomListings";
import ManageSeasons from "../../../Men/Local/Admin/Tabs/ManageSeasons";

function getInitialTab() {
  if (typeof window === "undefined") return "players";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "players";
}

function reducer(state, action){
  switch (action.type){
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    default:
      return state;
  }
}

export default function WAdminDashboard(){
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ activeTab: getInitialTab() }));
  const { activeTab } = state;

  const tabs = useMemo(
    () => [
      { id: "players", label: "Manage Players" },
      { id: "requests", label: "Account Requests" },
      { id: "email", label: "Email Center" },
      { id: "sponsors", label: "Sponsors" },
      { id: "events", label: "Events" },
      { id: "raffles", label: "Raffles" },
      { id: "fundraisers", label: "Fundraisers" },
      { id: "custom-listings", label: "Custom Listings" },
      { id: "seasons", label: "Seasons" },
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
      case "fundraisers":
        return <ManageFundraisers />;
      case "custom-listings":
        return <ManageCustomListings />;
      case "seasons":
        return <ManageSeasons />;
      case "stream":
        return <StreamSetup />;
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 pb-16">
      <div className="mb-8">
        <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          <span className="h-px w-6 bg-[#5E0009]/40" />
          Team Management
          <span className="h-px w-6 bg-[#5E0009]/40" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Tab controls: stacked sidebar */}
        <nav className="flex flex-row flex-wrap md:flex-col gap-2 md:sticky md:top-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
              className={`px-4 py-2 rounded-full text-sm font-semibold text-left transition-all ${
                activeTab === tab.id
                  ? "bg-[#5E0009] text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-[#5E0009]/40 hover:text-[#5E0009]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="animate-fadeIn min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {renderActiveTab}
        </div>
      </div>
    </div>
  );
}

