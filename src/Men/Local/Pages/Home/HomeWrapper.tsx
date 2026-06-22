// src/Men/Local/Pages/Home/HomeWrapper.jsx
import MainContent from "./MainContent";
import Quicklinks from "./Quicklinks";
import SocialFeeds from "./SocialFeeds";
import UpcomingGames from "./UpcomingGames";

export default function Home(){
  return(
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <MainContent />
      <UpcomingGames />
      <SocialFeeds />
      <Quicklinks />
    </div>
  );
}
