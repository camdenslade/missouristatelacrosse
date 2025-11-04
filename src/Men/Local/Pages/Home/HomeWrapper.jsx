// src/Men/Local/Pages/Home/HomeWrapper.jsx
import Hero from "./Hero.jsx";
import About from "./About.jsx";
import SocialFeeds from "./SocialFeeds.jsx";
import Quicklinks from "./Quicklinks.jsx";
import { useAuth } from "../../Context/AuthContext.jsx";

export default function Home(){
  const { role: userRole } = useAuth();

  return(
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <Hero />
      <About />
      <SocialFeeds userRole={userRole} />
      <Quicklinks />
    </div>
  );
}