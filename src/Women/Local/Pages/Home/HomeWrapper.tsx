// src/Women/Local/Pages/Home/HomeWrapper.jsx
import MainContent from "./MainContent";
import Quicklinks from "./Quicklinks";
import SocialFeeds from "./SocialFeeds";

export default function WHome(){
  return(
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <MainContent />
      <SocialFeeds />
      <Quicklinks />
    </div>
  );
}
