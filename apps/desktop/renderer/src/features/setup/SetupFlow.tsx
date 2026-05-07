import { setupSteps } from "./setup-steps";

export const SetupFlow = () => {
  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Setup</p>
        <h1>Molten Voice</h1>
        <ol className="step-list">
          {setupSteps.map((step, index) => (
            <li key={step.path}>
              <span>{index + 1}</span>
              {step.title}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};
