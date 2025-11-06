// src/Men/Local/Pages/Home/HomeWrapper.jsx
import About from "./About.jsx";
import MainContent from "./MainContent.jsx";
import Quicklinks from "./Quicklinks.jsx";
import SocialFeeds from "./SocialFeeds.jsx";
import { useAuth } from "../../../../Global/Context/AuthContext.jsx";

export default function Home(){
  const { role: userRole } = useAuth();

  return(
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <MainContent />
      <About />
      <SocialFeeds userRole={userRole} />
      <Quicklinks />
    </div>
  );
}