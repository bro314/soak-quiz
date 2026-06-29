import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "../components/RootLayout";
import { AdminHome } from "../admin/AdminHome";
import { EventDashboard } from "../admin/EventDashboard";
import { RoundEditor } from "../admin/RoundEditor";
import { QuestionEditor } from "../admin/QuestionEditor";
import { ValidationScreen } from "../admin/ValidationScreen";

import { EventScreen } from "../participant/EventScreen";
import { TeamLoginScreen } from "../participant/TeamLoginScreen";
import { EventHomeScreen } from "../participant/EventHomeScreen";
import { SettingsScreen } from "../participant/SettingsScreen";
import { TeamJoinByTokenScreen } from "../participant/TeamJoinByTokenScreen";
import { RoundScreen } from "../participant/RoundScreen";
import { QuestionScreen } from "../participant/QuestionScreen";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        async lazy() {
          // Just a placeholder routing setup for the landing / team screens.
          const { default: App } = await import("../App");
          return { Component: App };
        },
      },
      {
        path: "/event/:eventId",
        element: <EventScreen />,
      },
      {
        path: "/event/:eventId/login/:teamId",
        element: <TeamLoginScreen />,
      },
      {
        path: "/event/:eventId/home",
        element: <EventHomeScreen />,
      },
      {
        path: "/event/:eventId/settings",
        element: <SettingsScreen />,
      },
      {
        path: "/event/:eventId/join/:teamId/:token",
        element: <TeamJoinByTokenScreen />,
      },
      {
        path: "/event/:eventId/round/:roundId",
        element: <RoundScreen />,
      },
      {
        path: "/event/:eventId/round/:roundId/question/:questionId",
        element: <QuestionScreen />,
      },
      {
        path: "/admin",
        element: <AdminHome />,
      },
      {
        path: "/admin/event/:eventId",
        element: <EventDashboard />,
      },
      {
        path: "/admin/event/:eventId/round/:roundId",
        element: <RoundEditor />,
      },
      {
        path: "/admin/event/:eventId/round/:roundId/question/:questionId",
        element: <QuestionEditor />,
      },
      {
        path: "/admin/event/:eventId/validation",
        element: <ValidationScreen />,
      },
    ],
  },
]);


