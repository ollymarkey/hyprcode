import * as React from "react";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

import { WorkspaceDashboard } from "./components/WorkspaceDashboard";

function RootLayout() {
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorkspaceDashboard,
});

const routeTree = rootRoute.addChildren([dashboardRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
