import { useState, useEffect } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { signOut } from "firebase/auth";
import { createEventCallable, loginAdminCallable } from "../firebase/functions";
import { AdminLayout } from "./components/AdminLayout";
import { Link, useNavigate } from "react-router-dom";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type { Event } from "../types";
import { useClaims } from "../hooks/useClaims";

export function AdminHome() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { claims, loading: claimsLoading, refreshClaims } = useClaims();

  // Create Event Form state
  const [newEventId, setNewEventId] = useState("");
  const [name, setName] = useState("");
  const [maxTeamSize, setMaxTeamSize] = useState(6);
  const [adminPassword, setAdminPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Login Event Form state
  const [loginEventId, setLoginEventId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!claims.eventId || claims.role !== "admin") {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, "events", claims.eventId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setEvents([{ id: docSnap.id, ...docSnap.data() } as Event]);
        } else {
          setEvents([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Could not load event details:", err);
        setEvents([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [claims.eventId, claims.role]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventId || !name || !adminPassword) {
      setCreateError("Bitte fülle alle Pflichtfelder aus.");
      return;
    }
    setCreateLoading(true);
    setCreateError("");
    try {
      await createEventCallable({
        eventId: newEventId,
        name,
        maxTeamSize,
        adminPassword,
      });
      const createdEventId = newEventId;
      await refreshClaims();
      setNewEventId("");
      setName("");
      setAdminPassword("");
      setCreateError("");
      navigate(`/admin/event/${createdEventId}`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Fehler beim Erstellen des Events.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEventId || !loginPassword) {
      setLoginError("Bitte Event-ID und Passwort eingeben.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    try {
      await loginAdminCallable({ eventId: loginEventId, password: loginPassword });
      const targetEventId = loginEventId;
      await refreshClaims();
      setLoginEventId("");
      setLoginPassword("");
      navigate(`/admin/event/${targetEventId}`);
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || "Falsches Passwort oder ungültige Event-ID.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await refreshClaims();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isAdmin = claims.role === "admin";

  return (
    <AdminLayout>
      <Container maxWidth="lg">
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800, mb: 4 }}>
          Event-Management
        </Typography>

        <Grid container spacing={4}>
          {/* Create Event Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card className="glass" sx={{ p: 2 }}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                  Neues Event erstellen
                </Typography>

                {createError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {createError}
                  </Alert>
                )}

                <form onSubmit={handleCreateEvent}>
                  <TextField
                    label="Event ID (z.B. soak-2026)"
                    fullWidth
                    variant="outlined"
                    value={newEventId}
                    onChange={(e) => setNewEventId(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                    sx={{ mb: 2 }}
                    required
                    helperText="Nur Buchstaben, Zahlen, Bindestriche und Unterstriche."
                  />
                  <TextField
                    label="Event Name"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mb: 2 }}
                    required
                  />
                  <TextField
                    label="Maximale Teamgröße"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={maxTeamSize}
                    onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                    sx={{ mb: 2 }}
                    required
                  />
                  <TextField
                    label="Admin Passwort"
                    type="password"
                    fullWidth
                    variant="outlined"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    sx={{ mb: 3 }}
                    required
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    disabled={createLoading}
                  >
                    {createLoading ? <CircularProgress size={24} /> : "Event erstellen"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column: List of Events OR Login Form */}
          <Grid size={{ xs: 12, md: 6 }}>
            {claimsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : isAdmin ? (
              /* Logged In: List of Events */
              <Card className="glass" sx={{ p: 2 }}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                    Dein Event
                  </Typography>

                  {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : events.length === 0 ? (
                    <Typography color="text.secondary">
                      Keine Events gefunden. Erstelle links ein neues Event.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <List sx={{ width: "100%", bgcolor: "transparent", p: 0 }}>
                        {events.map((event) => (
                          <ListItem key={event.id} disablePadding sx={{ border: "1px solid rgba(255,255,255,0.05)", borderRadius: 1 }}>
                            <ListItemButton component={Link} to={`/admin/event/${event.id}`}>
                              <ListItemText
                                primary={<Typography sx={{ fontWeight: 600 }}>{event.name}</Typography>}
                                secondary={`ID: ${event.id} | Max Teamgröße: ${event.maxTeamSize} | Status: ${event.status}`}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                      <Button
                        onClick={handleLogout}
                        variant="outlined"
                        color="secondary"
                        fullWidth
                        size="large"
                      >
                        Abmelden
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Not Logged In: Login Form */
              <Card className="glass" sx={{ p: 2 }}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                    Bestehendes Event verwalten
                  </Typography>

                  {loginError && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {loginError}
                    </Alert>
                  )}

                  <form onSubmit={handleLogin}>
                    <TextField
                      label="Event-ID"
                      fullWidth
                      variant="outlined"
                      value={loginEventId}
                      onChange={(e) => setLoginEventId(e.target.value)}
                      sx={{ mb: 2 }}
                      required
                    />
                    <TextField
                      label="Admin Passwort"
                      type="password"
                      fullWidth
                      variant="outlined"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      sx={{ mb: 3 }}
                      required
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      fullWidth
                      size="large"
                      disabled={loginLoading}
                    >
                      {loginLoading ? <CircularProgress size={24} /> : "Als Admin einloggen"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Container>
    </AdminLayout>
  );
}
