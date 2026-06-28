import { createBrowserRouter } from "react-router-dom";
import { AdminHome } from "../admin/AdminHome";
import { EventDashboard } from "../admin/EventDashboard";
import { RoundEditor } from "../admin/RoundEditor";
import { QuestionEditor } from "../admin/QuestionEditor";
import { ValidationScreen } from "../admin/ValidationScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    async lazy() {
      // Just a placeholder routing setup for the landing / team screens.
      const { default: App } = await import("../App");
      return { Component: App };
    },
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
]);
