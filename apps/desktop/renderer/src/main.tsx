import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { OverlayApp } from "./OverlayApp";
import "./styles.css";

const RootApp = window.location.hash === "#overlay" ? OverlayApp : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
