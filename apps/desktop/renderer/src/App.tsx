import { HistoryView } from "./features/history/HistoryView";
import { OverlayView } from "./features/overlay/OverlayView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  return (
    <main className="grid min-h-screen grid-cols-[286px_minmax(0,1fr)_336px] overflow-hidden bg-background text-foreground max-[1040px]:grid-cols-[240px_minmax(0,1fr)] max-md:grid-cols-1 max-md:overflow-auto">
      <SetupFlow>
        <HistoryView />
      </SetupFlow>
      <OverlayView />
    </main>
  );
};
