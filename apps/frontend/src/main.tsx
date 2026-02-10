import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./tailwind.css";
import { initThemeMode } from "./theme/theme-mode";
import "./theme.css";
import "./styles.css";

initThemeMode();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
