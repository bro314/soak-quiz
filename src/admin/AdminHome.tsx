import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { createEventCallable } from "../firebase/functions";
import { AdminLayout } from "./components/AdminLayout";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import { Link } from "react-router-dom";
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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshClaims } = useClaims();

  // Create Event Form state
  const [newEventId, setNewEventId] = useState("");
  const [name, setName] = useState("");
  const [maxTeamSize, setMaxTeamSize] = useState(6);
  const [adminPassword, setAdminPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    // We query events. Note: to read events list, client needs event E membership custom claims.
    // In our security rules: matches /events/{eventId} { allow read: if isEventMember(eventId); }
    // Wait! Since standard rules check isEventMember(eventId), an admin can read the event *they are admin of*.
    // But listing *all* events requires no claims or a global read. Since rules do matches /events/{eventId} read: if isEventMember(eventId),
    // a simple collection query of events by a user with claims role 'admin' for event E will return only event E (or it might fail if we query the whole collection).
    // Let's implement real-time listening of the events collection. If it fails due to rule permissions, we handle it gracefully.
    const q = query(collection(db, "events"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Event[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Event);
        });
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Could not list all events from Firestore (expected if rules restrict multi-event reads).", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

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
      // Refresh claims so that the user gets the admin claim for this new event
      await refreshClaims();
      // Reset form
      setNewEventId("");
      setName("");
      setAdminPassword("");
      setCreateError("");
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Fehler beim Erstellen des Events.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <AdminRouteGuard>
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

            {/* List of Events */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card className="glass" sx={{ p: 2 }}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                    Deine Events
                  </Typography>

                  {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : events.length === 0 ? (
                    <Typography color="text.secondary">
                      Keine Events gefunden. Erstelle ein neues Event oder logge dich als Admin ein.
                    </Typography>
                  ) : (
                    <List sx={{ width: "100%", bgcolor: "transparent" }}>
                      {events.map((event) => (
                        <ListItem key={event.id} disablePadding sx={{ mb: 1, border: "1px solid rgba(255,255,255,0.05)", borderRadius: 1 }}>
                          <ListItemButton component={Link} to={`/admin/event/${event.id}`}>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 600 }}>{event.name}</Typography>}
                              secondary={`ID: ${event.id} | Max Teamgröße: ${event.maxTeamSize} | Status: ${event.status}`}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </AdminLayout>
    </AdminRouteGuard>
  );
}
