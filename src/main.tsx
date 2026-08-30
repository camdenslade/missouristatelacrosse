// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthProvider } from "./Global/Context/AuthContext";
import { MenCartProvider } from "./Men/Local/Pages/Store/context/MenCartContext";
import { WomenCartProvider } from "./Women/Local/Pages/Store/context/WomenCartContext";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AuthProvider>
      <MenCartProvider>
        <WomenCartProvider>
          <App />
        </WomenCartProvider>
      </MenCartProvider>
    </AuthProvider>
  </React.StrictMode>
);

