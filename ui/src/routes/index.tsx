import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../App";
import { APP_ROUTE_ITEMS } from "./manifest";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/main" replace /> },
  {
    element: <AppShell />,
    children: APP_ROUTE_ITEMS.map((item) => ({ path: item.path, element: item.element })),
  },
]);
