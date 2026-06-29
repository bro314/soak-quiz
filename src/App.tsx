import { useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Event } from "./types";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import QuizIcon from "@mui/icons-material/Quiz";
import PlayArrowIcon from "@mui/icons-material/PlayArrowOutlined";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";

import { Link } from "react-router-dom";
import Button from "@mui/material/Button";

type ConnectionState = "connecting" | "connected" | "error";

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [user, setUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
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

    // Listen to active events
    const q = query(collection(db, "events"), where("status", "==", "ACTIVE"));
    const unsubscribeEvents = onSnapshot(
      q,
      (snapshot) => {
        const list: Event[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Event);
        });
        // Sort events alphabetically by name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setActiveEvents(list);
        setEventsLoading(false);
      },
      (err) => {
        console.error("Error loading active events:", err);
        setEventsError("Fehler beim Laden der aktiven Events.");
        setEventsLoading(false);
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeEvents();
    };
  }, []);

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

      {/* Active Events Card */}
      <Card
        className="glass"
        sx={{
          width: "100%",
          maxWidth: 420,
          mb: 4,
          animation: "fadeInUp 0.6s ease-out",
          "@keyframes fadeInUp": {
            from: { opacity: 0, transform: "translateY(20px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 700 }}>
            Aktive Events
          </Typography>

          {eventsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress color="secondary" size={32} />
            </Box>
          ) : eventsError ? (
            <Alert severity="error" sx={{ mb: 2 }}>{eventsError}</Alert>
          ) : activeEvents.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
              Aktuell gibt es keine aktiven Events. Bitte wende dich an die Eventleitung.
            </Typography>
          ) : (
            <List disablePadding>
              {activeEvents.map((evt) => (
                <ListItem
                  key={evt.id}
                  disablePadding
                  sx={{
                    mb: 1.5,
                    border: "1px solid rgba(124, 77, 255, 0.15)",
                    borderRadius: 2,
                    overflow: "hidden",
                    background: "rgba(255, 255, 255, 0.02)",
                    "&:hover": {
                      background: "rgba(124, 77, 255, 0.08)",
                      borderColor: "rgba(124, 77, 255, 0.3)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  <ListItemButton component={Link} to={`/event/${evt.id}`} sx={{ py: 2 }}>
                    <PlayArrowIcon color="secondary" sx={{ mr: 2 }} />
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {evt.name}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {connectionState === "connected" && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Button component={Link} to="/admin" variant="contained" color="secondary">
            Admin-Bereich
          </Button>
          
          <Typography
            variant="caption"
            sx={{
              color: "success.main",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              opacity: 0.8
            }}
          >
            ● Verbunden
          </Typography>
        </Box>
      )}

      {connectionState === "error" && (
        <Typography
          variant="caption"
          sx={{
            color: "error.main",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            opacity: 0.8
          }}
        >
          ● Verbindungsfehler: {errorMessage}
        </Typography>
      )}
    </Container>
  );
}
