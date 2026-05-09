import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { App } from "./App";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const workbenchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup/$step",
  component: () => <App view="setup" />,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: () => <App view="history" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: App,
});

const routeTree = rootRoute.addChildren([workbenchRoute, setupRoute, historyRoute, settingsRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
