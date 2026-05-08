import type { ReactNode } from "react";
import { ModelPicker } from "./ModelPicker";
import { setupSteps } from "./setup-steps";

interface SetupFlowProps {
  readonly children?: ReactNode;
}

export const SetupFlow = ({ children }: SetupFlowProps) => {
  return (
    <>
      <aside className="setup-rail">
        <div className="brand-lockup">
          <span className="brand-mark">MV</span>
          <div>
            <p className="eyebrow">Local system layer</p>
            <h1>Molten Voice</h1>
          </div>
        </div>
        <nav aria-label="Setup progress">
          <ol className="step-list">
            {setupSteps.map((step, index) => (
              <li key={step.path} className={index < 2 ? "is-ready" : undefined}>
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <section className="dictation-surface">
        <header className="workbench-header">
          <div>
            <p className="eyebrow">Hold-to-talk</p>
            <h2>Ready for local dictation</h2>
          </div>
          <div className="status-strip" aria-label="Dictation status">
            <span>Offline</span>
            <span>CapsLock</span>
            <span>Paste</span>
          </div>
        </header>
        <div className="recording-stage">
          <div className="stage-meter" aria-hidden="true">
            {Array.from({ length: 38 }, (_, index) => (
              <span key={index} style={{ height: `${18 + ((index * 17) % 54)}px` }} />
            ))}
          </div>
          <div className="stage-copy">
            <p>Selected input remains focused while the overlay records from the system edge.</p>
            <strong>Audio is temporary. Transcript history stores text only.</strong>
          </div>
        </div>
        <ModelPicker />
      </section>
      {children}
    </>
  );
};
