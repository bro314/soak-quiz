import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { Outlet } from "react-router-dom";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

export function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoading(false);
      } else {
        setLoading(true);
        signInAnonymously(auth).catch((err) => {
          console.error("Firebase auth failed:", err);
          setError(err.message || "Failed to initialize connection.");
          setLoading(false);
        });
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <Container
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <CircularProgress color="secondary" />
          <Typography color="text.secondary" variant="body1">
            Verbindung wird hergestellt…
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container
        maxWidth="sm"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Alert severity="error" sx={{ width: "100%" }}>
          <Typography variant="h6" gutterBottom>
            Verbindungsfehler
          </Typography>
          {error}
        </Alert>
      </Container>
    );
  }

  return <Outlet />;
}
