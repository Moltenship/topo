import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { OverlayApp } from "./overlay-app";
import { syncDocumentWindowControlsOverlayClass } from "./lib/window-controls-overlay";
import { router } from "./routes";
import "./styles.css";

syncDocumentWindowControlsOverlayClass();

const RootApp = () =>
  window.location.hash === "#overlay" ? <OverlayApp /> : <RouterProvider router={router} />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
