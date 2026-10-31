import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import BackgroundMusic from "./components/BackgroundMusic";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <BackgroundMusic />
    <App />
  </StrictMode>
);
