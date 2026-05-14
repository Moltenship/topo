import type { TopoApi } from "@topo/shared";

export const getRendererApi = (): TopoApi => window.topo;
export const getRendererPlatform = () => getRendererApi().platform;
