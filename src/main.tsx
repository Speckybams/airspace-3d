import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
