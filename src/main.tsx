// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthProvider } from "./Global/Context/AuthContext";
import { MenCartProvider } from "./Men/Local/Pages/Store/context/MenCartContext";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AuthProvider>
      <MenCartProvider>
        <App />
      </MenCartProvider>
    </AuthProvider>
  </React.StrictMode>
);

