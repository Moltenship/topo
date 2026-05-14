import type { TopoApi } from "@topo/shared";

declare global {
  interface Window {
    topo: TopoApi;
  }
}

export {};
