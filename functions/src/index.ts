// Cloud Functions entry point.
// F1 (Auth/identity) and F2 (Grading/aggregation) will be implemented in M2 and M4.

import { onRequest } from "firebase-functions/v2/https";

// Health check — verifies the functions runtime is working.
export const healthCheck = onRequest(
  { region: "europe-west1" },
  (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  }
);
