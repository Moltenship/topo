import { HistoryView } from "./features/history/HistoryView";
import { OverlayView } from "./features/overlay/OverlayView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  return (
    <main className="workbench-shell">
      <SetupFlow>
        <HistoryView />
      </SetupFlow>
      <OverlayView />
    </main>
  );
};
