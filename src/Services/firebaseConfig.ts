import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC2tVXrGNBz_CPN5wxmRW5-mEDJ_h9UtWU",
  authDomain: "missouristatelacrosse-cc913.firebaseapp.com",
  projectId: "missouristatelacrosse-cc913",
  storageBucket: "missouristatelacrosse-cc913.appspot.com",
  messagingSenderId: "22298648445",
  appId: "1:22298648445:web:8314a649cefb239ca1f614",
  measurementId: "G-5YJSY6KJX4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Storage moved to S3; keep Firebase for auth only.

