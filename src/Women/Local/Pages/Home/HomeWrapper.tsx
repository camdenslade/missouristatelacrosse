// src/Women/Local/Pages/Home/HomeWrapper.jsx
import MainContent from "./MainContent";
import Quicklinks from "./Quicklinks";
import SocialFeeds from "./SocialFeeds";
import WUpcomingGames from "./UpcomingGames";

export default function WHome(){
  return(
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <MainContent />
      <WUpcomingGames />
      <SocialFeeds />
      <Quicklinks />
    </div>
  );
}
