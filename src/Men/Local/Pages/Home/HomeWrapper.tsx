import { lazy, Suspense } from "react";

import MainContent from "./MainContent";
import Quicklinks from "./Quicklinks";
import SocialFeeds from "./SocialFeeds";

// Split out so the map and its outline data load after the hero.
const RosterMap = lazy(() => import("../../../../Global/Common/RosterMap"));

export default function Home(){
  return(
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <MainContent />
      <Suspense fallback={null}>
        <RosterMap />
      </Suspense>
      <SocialFeeds />
      <Quicklinks />
    </div>
  );
}
