import { HistoryView } from "./features/history/HistoryView";
import { OverlayView } from "./features/overlay/OverlayView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  return (
    <>
      <SetupFlow />
      <HistoryView />
      <OverlayView />
    </>
  );
};
