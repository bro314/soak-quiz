import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { AdminLayout } from "./components/AdminLayout";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Chip from "@mui/material/Chip";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloseIcon from "@mui/icons-material/Close";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import AddIcon from "@mui/icons-material/Add";
import type { Event, Round, Team, Scoreboard } from "../types";

export function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Data state
  const [event, setEvent] = useState<Event | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scoreboards, setScoreboards] = useState<Scoreboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Round form state
  const [roundTitle, setRoundTitle] = useState("");
  const [roundDescription, setRoundDescription] = useState("");
  const [createRoundLoading, setCreateRoundLoading] = useState(false);

  // Dialog states
  const [openResetDialog, setOpenResetDialog] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    // Listen to event doc
    const unsubEvent = onSnapshot(doc(db, `events/${eventId}`), (snap) => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...snap.data() } as Event);
      } else {
        setError("Event nicht gefunden.");
      }
    });

    // Listen to rounds
    const unsubRounds = onSnapshot(collection(db, `events/${eventId}/rounds`), (snap) => {
      const list: Round[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Round);
      });
      // Sort by number
      list.sort((a, b) => a.number - b.number);
      setRounds(list);
    });

    // Listen to teams
    const unsubTeams = onSnapshot(collection(db, `events/${eventId}/teams`), (snap) => {
      const list: Team[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Team);
      });
      setTeams(list);
    });

    // Listen to scoreboards
    const unsubScores = onSnapshot(collection(db, `events/${eventId}/scoreboard`), (snap) => {
      const list: Scoreboard[] = [];
      snap.forEach((d) => {
        list.push({ teamId: d.id, ...d.data() } as Scoreboard);
      });
      setScoreboards(list);
      setLoading(false);
    });

    return () => {
      unsubEvent();
      unsubRounds();
      unsubTeams();
      unsubScores();
    };
  }, [eventId]);

  const handleUpdateEventStatus = async (status: Event["status"]) => {
    if (!eventId || !event) return;
    try {
      await updateDoc(doc(db, `events/${eventId}`), { status });
    } catch (err: any) {
      console.error(err);
      alert("Fehler beim Aktualisieren des Event-Status: " + err.message);
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !roundTitle) return;
    setCreateRoundLoading(true);
    try {
      // Find smallest unused integer >= 1
      const numbers = rounds.map((r) => r.number);
      let nextNumber = 1;
      while (numbers.includes(nextNumber)) {
        nextNumber++;
      }

      const roundId = `round-${nextNumber}`;
      const roundRef = doc(db, `events/${eventId}/rounds/${roundId}`);
      const detailRef = doc(db, `events/${eventId}/rounds/${roundId}/detail/main`);

      // Write round and details
      await setDoc(roundRef, {
        number: nextNumber,
        title: roundTitle,
        status: "INACTIVE",
      });
      await setDoc(detailRef, {
        description: roundDescription,
      });

      setRoundTitle("");
      setRoundDescription("");
    } catch (err: any) {
      console.error(err);
      alert("Fehler beim Erstellen der Runde: " + err.message);
    } finally {
      setCreateRoundLoading(false);
    }
  };

  const handleStartNextRound = async () => {
    if (!eventId || rounds.length === 0) return;
    // Check if there is already an active round
    const hasActiveRound = rounds.some((r) => r.status === "ACTIVE");
    if (hasActiveRound) {
      alert("Es läuft bereits eine aktive Runde.");
      return;
    }
    // Find first round that is INACTIVE
    const nextRound = rounds.find((r) => r.status === "INACTIVE");
    if (!nextRound) {
      alert("Keine inaktiven Runden mehr vorhanden.");
      return;
    }
    try {
      await updateDoc(doc(db, `events/${eventId}/rounds/${nextRound.id}`), {
        status: "ACTIVE",
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleCloseCurrentRound = async () => {
    if (!eventId) return;
    // Find active round
    const activeRound = rounds.find((r) => r.status === "ACTIVE");
    if (!activeRound) {
      alert("Es gibt momentan keine aktive Runde.");
      return;
    }
    try {
      await updateDoc(doc(db, `events/${eventId}/rounds/${activeRound.id}`), {
        status: "VALIDATION",
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleResetEvent = async () => {
    if (!eventId) return;
    setOpenResetDialog(false);
    try {
      // 1. Delete all teams and their auth/scoreboard docs
      const batch = writeBatch(db);

      // Deleting collections client-side in Firestore is done document by document.
      teams.forEach((t) => {
        batch.delete(doc(db, `events/${eventId}/teams/${t.id}`));
        batch.delete(doc(db, `events/${eventId}/scoreboard/${t.id}`));
      });

      // Reset all rounds to INACTIVE
      rounds.forEach((r) => {
        batch.update(doc(db, `events/${eventId}/rounds/${r.id}`), {
          status: "INACTIVE",
        });
      });

      // Update event status to INACTIVE
      batch.update(doc(db, `events/${eventId}`), { status: "INACTIVE" });

      await batch.commit();
      alert("Event erfolgreich zurückgesetzt.");
    } catch (err: any) {
      console.error(err);
      alert("Fehler beim Zurücksetzen des Events: " + err.message);
    }
  };

  if (loading) {
    return (
      <AdminRouteGuard>
        <AdminLayout>
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        </AdminLayout>
      </AdminRouteGuard>
    );
  }

  if (error || !event) {
    return (
      <AdminRouteGuard>
        <AdminLayout>
          <Alert severity="error">{error || "Event nicht geladen."}</Alert>
        </AdminLayout>
      </AdminRouteGuard>
    );
  }

  // Compute scoreboard metrics
  const scoreboardMap = new Map(scoreboards.map((s) => [s.teamId, s]));

  return (
    <AdminRouteGuard>
      <AdminLayout>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
                {event.name}
              </Typography>
              <Typography color="text.secondary">
                Event-ID: {event.id} | Maximale Teamgröße: {event.maxTeamSize}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip
                label={event.status === "ACTIVE" ? "Gestartet (ACTIVE)" : "Inaktiv (INACTIVE)"}
                color={event.status === "ACTIVE" ? "success" : "default"}
                variant="outlined"
              />
            </Box>
          </Box>

          {/* Quick Actions Dashboard */}
          <Card className="glass" sx={{ p: 2, mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                Event Steuerung
              </Typography>
              <Grid container spacing={2}>
                {event.status === "INACTIVE" ? (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handleUpdateEventStatus("ACTIVE")}
                    >
                      Event starten
                    </Button>
                  </Grid>
                ) : (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Button
                      variant="outlined"
                      color="warning"
                      fullWidth
                      startIcon={<CloseIcon />}
                      onClick={() => handleUpdateEventStatus("INACTIVE")}
                    >
                      Event stoppen
                    </Button>
                  </Grid>
                )}

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<SkipNextIcon />}
                    onClick={handleStartNextRound}
                    disabled={event.status !== "ACTIVE" || rounds.some((r) => r.status === "ACTIVE")}
                  >
                    Nächste Runde starten
                  </Button>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="contained"
                    color="warning"
                    fullWidth
                    startIcon={<CloseIcon />}
                    onClick={handleCloseCurrentRound}
                    disabled={event.status !== "ACTIVE"}
                  >
                    Aktuelle Runde schließen
                  </Button>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    startIcon={<RotateLeftIcon />}
                    onClick={() => setOpenResetDialog(true)}
                  >
                    Event zurücksetzen
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Grid container spacing={4}>
            {/* Scoreboard table */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card className="glass" sx={{ p: 2, mb: 4 }}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                    Gesamter Spielstand
                  </Typography>

                  {teams.length === 0 ? (
                    <Typography color="text.secondary">Noch keine Teams registriert.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ bgcolor: "transparent", backgroundImage: "none" }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Team Name</TableCell>
                            {rounds.map((r) => (
                              <TableCell key={r.id} align="right" sx={{ fontWeight: 700 }}>
                                R{r.number}
                              </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              Gesamt
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {teams.map((team) => {
                            const score = scoreboardMap.get(team.id);
                            return (
                              <TableRow key={team.id}>
                                <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                                  {team.name}
                                </TableCell>
                                {rounds.map((r) => {
                                  const roundPoints = score?.perRound?.[r.id] ?? 0;
                                  return (
                                    <TableCell key={r.id} align="right">
                                      {roundPoints}
                                    </TableCell>
                                  );
                                })}
                                <TableCell align="right" sx={{ fontWeight: 700, color: "secondary.main" }}>
                                  {score?.total ?? 0}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow sx={{ "& td, & th": { fontWeight: 700, borderTop: "2px dashed rgba(255, 255, 255, 0.15)" } }}>
                            <TableCell>Gesamt</TableCell>
                            {rounds.map((r) => {
                              const totalRoundPoints = teams.reduce((sum, team) => {
                                const score = scoreboardMap.get(team.id);
                                return sum + (score?.perRound?.[r.id] ?? 0);
                              }, 0);
                              return (
                                <TableCell key={r.id} align="right">
                                  {totalRoundPoints}
                                </TableCell>
                              );
                            })}
                            <TableCell align="right" sx={{ color: "primary.main" }}>
                              {teams.reduce((sum, team) => {
                                const score = scoreboardMap.get(team.id);
                                return sum + (score?.total ?? 0);
                              }, 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Rounds List & Creation */}
            <Grid size={{ xs: 12, lg: 4 }}>
              {/* Creation Form */}
              <Card className="glass" sx={{ p: 2, mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                    Runde hinzufügen
                  </Typography>
                  <form onSubmit={handleCreateRound}>
                    <TextField
                      label="Titel der Runde"
                      fullWidth
                      variant="outlined"
                      value={roundTitle}
                      onChange={(e) => setRoundTitle(e.target.value)}
                      sx={{ mb: 2 }}
                      required
                    />
                    <TextField
                      label="Beschreibung (optional)"
                      fullWidth
                      multiline
                      rows={2}
                      variant="outlined"
                      value={roundDescription}
                      onChange={(e) => setRoundDescription(e.target.value)}
                      sx={{ mb: 3 }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      startIcon={<AddIcon />}
                      disabled={createRoundLoading}
                    >
                      Runde erstellen
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Rounds List */}
              <Card className="glass" sx={{ p: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                    Rundenliste
                  </Typography>
                  {rounds.length === 0 ? (
                    <Typography color="text.secondary">Noch keine Runden angelegt.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ bgcolor: "transparent", backgroundImage: "none" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Nr.</TableCell>
                            <TableCell>Titel</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rounds.map((r) => (
                             <TableRow
                               key={r.id}
                               hover
                               sx={{ cursor: "pointer" }}
                               onClick={() => navigate(`/admin/event/${eventId}/round/${r.id}`)}
                             >
                               <TableCell>{r.number}</TableCell>
                               <TableCell style={{ fontWeight: 600 }}>
                                 {r.title}
                               </TableCell>
                               <TableCell>
                                 <Chip label={r.status} size="small" variant="outlined" color={r.status === "ACTIVE" ? "success" : r.status === "VALIDATION" ? "warning" : "default"} />
                               </TableCell>
                             </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>

        {/* Reset Confirmation Dialog */}
        <Dialog open={openResetDialog} onClose={() => setOpenResetDialog(false)}>
          <DialogTitle sx={{ fontWeight: 700 }}>Event wirklich zurücksetzen?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Dieser Vorgang löscht alle registrierten Teams, alle Antworten und setzt alle Runden und Fragen in den Status INACTIVE zurück. Dies kann nicht rückgängig gemacht werden.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenResetDialog(false)}>Abbrechen</Button>
            <Button onClick={handleResetEvent} color="error" variant="contained">
              Zurücksetzen
            </Button>
          </DialogActions>
        </Dialog>
      </AdminLayout>
    </AdminRouteGuard>
  );
}
