import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DesktopLyricsWindow } from "./DesktopLyricsWindow";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const params = new URLSearchParams(window.location.search);
const isDesktopLyricsWindow = params.get("window") === "desktop-lyrics";

root.render(
  <React.StrictMode>
    {isDesktopLyricsWindow ? <DesktopLyricsWindow /> : <App />}
  </React.StrictMode>
);
