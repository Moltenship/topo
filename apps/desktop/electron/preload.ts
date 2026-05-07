import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("moltenVoice", {
  appName: "Molten Voice",
});
