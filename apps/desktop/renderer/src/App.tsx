import { getRendererApi } from "./api/renderer-api";

export const App = () => {
  const api = getRendererApi();

  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Local-first dictation</p>
        <h1>{api.appName}</h1>
        <p>Hold a hotkey, speak, and insert private local transcripts into the active app.</p>
      </section>
    </main>
  );
};
