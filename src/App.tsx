import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import QuizIcon from "@mui/icons-material/Quiz";

import { Link, RouterProvider } from "react-router-dom";
import { router } from "./routes";
import Button from "@mui/material/Button";

type ConnectionState = "connecting" | "connected" | "error";

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [user, setUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setConnectionState("connected");
      }
    });

    // Sign in anonymously to verify Firebase connection
    signInAnonymously(auth).catch((err) => {
      setConnectionState("error");
      setErrorMessage(err.message);
    });

    return unsubscribe;
  }, []);

  // When visiting the main path directly, render the splash / connection status page.
  // When hitting admin or subpaths, RouterProvider handles rendering.
  // Note: we can export a sub-component for the landing page or just render it inside App.
  if (window.location.pathname !== "/") {
    return <RouterProvider router={router} />;
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Logo / Title */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 1,
        }}
      >
        <QuizIcon
          sx={{
            fontSize: 48,
            background: "linear-gradient(135deg, #7C4DFF, #00E5FF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 20px rgba(124, 77, 255, 0.4))",
          }}
        />
        <Typography
          variant="h2"
          component="h1"
          sx={{
            background: "linear-gradient(135deg, #B388FF 0%, #00E5FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          SoAk Quiz
        </Typography>
      </Box>

      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 5, textAlign: "center" }}
      >
        Das interaktive Quiz für dein Event
      </Typography>

      {/* Connection Status Card */}
      <Card
        className="glass"
        sx={{
          width: "100%",
          maxWidth: 420,
          animation: "fadeInUp 0.6s ease-out",
          "@keyframes fadeInUp": {
            from: { opacity: 0, transform: "translateY(20px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Firebase-Verbindung
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {connectionState === "connecting" && (
              <>
                <CircularProgress size={24} color="secondary" />
                <Typography color="text.secondary">
                  Verbindung wird hergestellt…
                </Typography>
              </>
            )}

            {connectionState === "connected" && (
              <>
                <CheckCircleOutlineIcon color="success" />
                <Box>
                  <Typography color="success.main" sx={{ fontWeight: 600 }}>
                    Verbunden
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    UID: {user?.uid?.slice(0, 12)}…
                  </Typography>
                </Box>
              </>
            )}

            {connectionState === "error" && (
              <>
                <ErrorOutlineIcon color="error" />
                <Box>
                  <Typography color="error.main" sx={{ fontWeight: 600 }}>
                    Verbindungsfehler
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {errorMessage}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {connectionState === "connected" && (
            <Box sx={{ mt: 3, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip label="Firestore ✓" size="small" color="success" variant="outlined" />
              <Chip label="Auth ✓" size="small" color="success" variant="outlined" />
              <Chip label="Anonym" size="small" color="secondary" variant="outlined" />
            </Box>
          )}
        </CardContent>
      </Card>

      {connectionState === "connected" && (
        <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
          <Button component={Link} to="/admin" variant="contained" color="secondary">
            Admin-Bereich
          </Button>
        </Box>
      )}

      {/* Version Info */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 4, opacity: 0.5 }}
      >
        M5 — Participant App
      </Typography>
    </Container>
  );
}
