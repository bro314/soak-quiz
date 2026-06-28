import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { loginTeamCallable } from "../firebase/functions";
import { useClaims } from "../hooks/useClaims";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LoginIcon from "@mui/icons-material/Login";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export function TeamLoginScreen() {
  const { eventId, teamId } = useParams<{ eventId: string; teamId: string }>();
  const navigate = useNavigate();
  const { claims, loading: claimsLoading, refreshClaims } = useClaims();
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in as this team
  useEffect(() => {
    if (!claimsLoading && claims.role === "team" && claims.eventId === eventId && claims.teamId === teamId) {
      navigate(`/event/${eventId}/home`);
    }
  }, [claims, claimsLoading, eventId, teamId, navigate]);

  // Fetch team name for user friendliness
  useEffect(() => {
    if (!eventId || !teamId) return;
    getDoc(doc(db, "events", eventId, "teams", teamId)).then((docSnap) => {
      if (docSnap.exists()) {
        setTeamName(docSnap.data().name);
      }
    });
  }, [eventId, teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !teamId) return;
    setLoading(true);
    setError("");

    try {
      await loginTeamCallable({ eventId, teamId, password });
      await refreshClaims();
      navigate(`/event/${eventId}/home`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falsches Passwort oder Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        component={Link}
        to={`/event/${eventId}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Zurück zur Team-Auswahl
      </Button>

      <Card className="glass">
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
            Team-Login
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Bitte gib das Passwort für Team <strong>{teamName || "..."}</strong> ein.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Passwort"
              type="password"
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoFocus
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              startIcon={<LoginIcon />}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Einloggen"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
