import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { createTeamCallable } from "../firebase/functions";
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
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export function SettingsScreen() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { claims, loading: claimsLoading, refreshClaims } = useClaims();

  // Mode: true = edit, false = create
  const isEditMode = claims.role === "team" && claims.eventId === eventId;
  const loggedInTeamId = claims.teamId;

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [memberNames, setMemberNames] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [joinToken, setJoinToken] = useState<string | null>(null);

  // Fetch team details if in edit mode
  useEffect(() => {
    if (isEditMode && loggedInTeamId && eventId) {
      setLoading(true);
      getDoc(doc(db, "events", eventId, "teams", loggedInTeamId))
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || "");
            setMemberNames(data.memberNames || "");
            // Retrieve joinToken from localStorage if available
            const savedToken = localStorage.getItem(`soak_quiz_join_token_${eventId}__${loggedInTeamId}`);
            if (savedToken) {
              setJoinToken(savedToken);
            }
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isEditMode, loggedInTeamId, eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isEditMode) {
        // Edit Mode: update memberNames in Firestore
        if (!loggedInTeamId) return;
        await updateDoc(doc(db, "events", eventId, "teams", loggedInTeamId), {
          memberNames,
        });
        setSuccess("Mitglieder erfolgreich aktualisiert.");
      } else {
        // Create Mode: call createTeam Cloud Function
        const res = await createTeamCallable({
          eventId,
          name,
          password,
          memberNames,
        });
        const teamId = res.data.teamId;
        const token = res.data.joinToken;
        if (teamId && token) {
          // Save join token in localStorage so we can show the QR code on settings screen later
          localStorage.setItem(`soak_quiz_join_token_${eventId}__${teamId}`, token);
          await refreshClaims();
          navigate(`/event/${eventId}/home`);
        } else {
          throw new Error("Fehler beim Abrufen der Team-ID.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Fehler beim Speichern der Einstellungen.");
    } finally {
      setLoading(false);
    }
  };

  const joinUrl = joinToken && loggedInTeamId
    ? `${window.location.origin}/event/${eventId}/join/${loggedInTeamId}/${joinToken}`
    : null;
  const qrCodeUrl = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`
    : null;

  if (claimsLoading) {
    return (
      <Container sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress color="secondary" />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        component={Link}
        to={isEditMode ? `/event/${eventId}/home` : `/event/${eventId}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        {isEditMode ? "Zurück zum Dashboard" : "Zurück zur Übersicht"}
      </Button>

      <Card className="glass">
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
            {isEditMode ? "Teameinstellungen" : "Team erstellen"}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Teamname"
              variant="outlined"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={isEditMode}
            />

            {!isEditMode && (
              <TextField
                label="Passwort"
                type="password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                helperText="Merke dir dieses Passwort. Du brauchst es zum Einloggen."
              />
            )}

            <TextField
              label="Teilnehmernamen"
              variant="outlined"
              value={memberNames}
              onChange={(e) => setMemberNames(e.target.value)}
              placeholder="z.B. Jonathan, Robin, Daniel, Ben"
              fullWidth
              multiline
              rows={3}
              helperText="Namen aller Teammitglieder (kann jederzeit geändert werden)"
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SaveIcon />}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Speichern"}
            </Button>
          </Box>

          {isEditMode && qrCodeUrl && (
            <Box sx={{ mt: 5, pt: 4, borderTop: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Mitglieder einladen
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Lass andere Teammitglieder diesen QR-Code scannen, um ohne Passwort beizutreten:
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                <Box
                  component="img"
                  src={qrCodeUrl}
                  alt="Join QR Code"
                  sx={{
                    width: 200,
                    height: 200,
                    borderRadius: 2,
                    border: "4px solid white",
                    backgroundColor: "white",
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                Oder Link teilen: <br />
                <a href={joinUrl!} target="_blank" rel="noopener noreferrer" style={{ color: "#00E5FF" }}>
                  {joinUrl}
                </a>
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
