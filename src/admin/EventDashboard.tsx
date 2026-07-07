import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, setDoc, updateDoc, writeBatch, query, where, getDocs } from "firebase/firestore";
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
import Snackbar from "@mui/material/Snackbar";
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
import CheckIcon from "@mui/icons-material/Check";
import type { Event, Round, Team, Scoreboard, Question } from "../types";
import { getQuestionLetter } from "../utils/question";


export function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Data state
  const [event, setEvent] = useState<Event | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scoreboards, setScoreboards] = useState<Scoreboard[]>([]);
  const [activeRoundQuestions, setActiveRoundQuestions] = useState<Question[]>([]);
  const [questionCounts, setQuestionCounts] = useState<{ [roundId: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Round form state
  const [roundTitle, setRoundTitle] = useState("");
  const [roundDescription, setRoundDescription] = useState("");
  const [createRoundLoading, setCreateRoundLoading] = useState(false);

  // Dialog states
  const [openResetDialog, setOpenResetDialog] = useState(false);

  // Snackbar toast state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

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

  // Listen to active round questions
  useEffect(() => {
    if (!eventId) return;
    const activeRound = rounds.find((r) => r.status === "ACTIVE");
    if (!activeRound) {
      setActiveRoundQuestions([]);
      return;
    }

    const unsubQuestions = onSnapshot(
      collection(db, `events/${eventId}/rounds/${activeRound.id}/questions`),
      (snap) => {
        const list: Question[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Question);
        });
        list.sort((a, b) => a.number - b.number);
        setActiveRoundQuestions(list);
      }
    );

    return () => {
      unsubQuestions();
    };
  }, [eventId, rounds]);

  // Listen to question counts for all rounds
  useEffect(() => {
    if (!eventId || rounds.length === 0) return;

    const unsubscribers = rounds.map((r) => {
      const qRef = collection(db, `events/${eventId}/rounds/${r.id}/questions`);
      return onSnapshot(qRef, (snap) => {
        setQuestionCounts((prev) => ({
          ...prev,
          [r.id]: snap.size,
        }));
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [eventId, rounds]);

  const handleUpdateEventStatus = async (status: Event["status"]) => {
    if (!eventId || !event) return;
    try {
      await updateDoc(doc(db, `events/${eventId}`), { status });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Aktualisieren des Event-Status: " + err.message, severity: "error" });
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
      navigate(`/admin/event/${eventId}/round/${roundId}`);
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Erstellen der Runde: " + err.message, severity: "error" });
    } finally {
      setCreateRoundLoading(false);
    }
  };

  const handleStartNextRound = async () => {
    if (!eventId || rounds.length === 0) return;
    // Check if there is already an active round
    const hasActiveRound = rounds.some((r) => r.status === "ACTIVE");
    if (hasActiveRound) {
      setSnackbar({ open: true, message: "Es läuft bereits eine aktive Runde.", severity: "warning" });
      return;
    }
    // Find first round that is INACTIVE
    const nextRound = rounds.find((r) => r.status === "INACTIVE");
    if (!nextRound) {
      setSnackbar({ open: true, message: "Keine inaktiven Runden mehr vorhanden.", severity: "warning" });
      return;
    }
    try {
      await updateDoc(doc(db, `events/${eventId}/rounds/${nextRound.id}`), {
        status: "ACTIVE",
      });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const handleCloseCurrentRound = async () => {
    if (!eventId) return;
    // Find active round
    const activeRound = rounds.find((r) => r.status === "ACTIVE");
    if (!activeRound) {
      setSnackbar({ open: true, message: "Es gibt momentan keine aktive Runde.", severity: "warning" });
      return;
    }
    try {
      // Check if there are any unvalidated answers for this round
      const answersRef = collection(db, `events/${eventId}/answers`);
      const unvalidatedAnswersSnap = await getDocs(
        query(
          answersRef,
          where("roundId", "==", activeRound.id),
          where("validated", "==", false)
        )
      );

      const status = unvalidatedAnswersSnap.empty ? "DONE" : "VALIDATION";

      await updateDoc(doc(db, `events/${eventId}/rounds/${activeRound.id}`), {
        status,
      });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const handleStartNextQuestion = async () => {
    const activeRound = rounds.find((r) => r.status === "ACTIVE");
    if (!eventId || !activeRound) return;
    const nextQuestion = activeRoundQuestions.find((q) => q.status === "INACTIVE");
    if (!nextQuestion) {
      setSnackbar({ open: true, message: "Keine inaktiven Fragen mehr vorhanden.", severity: "warning" });
      return;
    }
    try {
      await updateDoc(doc(db, `events/${eventId}/rounds/${activeRound.id}/questions/${nextQuestion.id}`), {
        status: "ACTIVE",
      });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: err.message, severity: "error" });
    }
  };

  const handleCompleteValidation = async () => {
    if (!eventId) return;
    const validationRound = rounds.find((r) => r.status === "VALIDATION");
    if (!validationRound) {
      setSnackbar({ open: true, message: "Es gibt momentan keine Runde in der Validierung.", severity: "warning" });
      return;
    }
    try {
      await updateDoc(doc(db, `events/${eventId}/rounds/${validationRound.id}`), {
        status: "DONE",
      });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: err.message, severity: "error" });
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
      setSnackbar({ open: true, message: "Event erfolgreich zurückgesetzt.", severity: "success" });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Zurücksetzen des Events: " + err.message, severity: "error" });
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

  const nextRound = rounds.find((r) => r.status === "INACTIVE");
  const activeRound = rounds.find((r) => r.status === "ACTIVE");
  const nextQuestion = activeRoundQuestions.find((q) => q.status === "INACTIVE");

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
              {/* First row: Event starten/stoppen. Event zurücksetzen. */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {event.status === "INACTIVE" ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                  <Grid size={{ xs: 12, sm: 6 }}>
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

                <Grid size={{ xs: 12, sm: 6 }}>
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

              {/* Second row: Nächste Runde starten, Nächste Frage starten, Aktuelle Runde schließen */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<SkipNextIcon />}
                    onClick={handleStartNextRound}
                    disabled={event.status !== "ACTIVE" || rounds.some((r) => r.status === "ACTIVE")}
                    sx={{ textAlign: "center" }}
                  >
                    {nextRound ? (
                      <>
                        Nächste Runde starten
                        <br />
                        (Runde {nextRound.number}: {nextRound.title})
                      </>
                    ) : (
                      "Nächste Runde starten"
                    )}
                  </Button>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    fullWidth
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStartNextQuestion}
                    disabled={event.status !== "ACTIVE" || !nextQuestion}
                    sx={{ textAlign: "center" }}
                  >
                    {nextQuestion ? (
                      <>
                        Nächste Frage starten
                        <br />
                        (Frage {getQuestionLetter(nextQuestion.number)}: {nextQuestion.title})
                      </>
                    ) : (
                      "Nächste Frage starten"
                    )}
                  </Button>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Button
                    variant="contained"
                    color="warning"
                    fullWidth
                    startIcon={<CloseIcon />}
                    onClick={handleCloseCurrentRound}
                    disabled={event.status !== "ACTIVE" || !activeRound}
                    sx={{ textAlign: "center" }}
                  >
                    {activeRound ? (
                      <>
                        Aktuelle Runde schließen
                        <br />
                        (Runde {activeRound.number}: {activeRound.title})
                      </>
                    ) : (
                      "Aktuelle Runde schließen"
                    )}
                  </Button>
                </Grid>

                {rounds.some((r) => r.status === "VALIDATION") && (
                  <Grid size={{ xs: 12, md: 12 }}>
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={<CheckIcon />}
                      onClick={handleCompleteValidation}
                      disabled={event.status !== "ACTIVE"}
                    >
                      Runde abschließen
                    </Button>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Rundenliste and Runde hinzufügen next to each other */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            {/* Rundenliste */}
            <Grid size={{ xs: 12, md: event.status === "ACTIVE" ? 12 : 6 }}>
              <Card className="glass" sx={{ p: 2, height: "100%" }}>
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
                            <TableCell>Fragen</TableCell>
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
                                 {questionCounts[r.id] ?? 0}
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

            {/* Creation Form */}
            {event.status !== "ACTIVE" && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card className="glass" sx={{ p: 2, height: "100%" }}>
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
              </Grid>
            )}
          </Grid>

          {/* Scoreboard table */}
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <Card className="glass" sx={{ p: 2, mb: 4 }}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                    Spielstand
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
                          {[...teams]
                            .sort((a, b) => {
                              const scoreA = scoreboardMap.get(a.id)?.total ?? 0;
                              const scoreB = scoreboardMap.get(b.id)?.total ?? 0;
                              if (scoreB !== scoreA) {
                                return scoreB - scoreA;
                              }
                              return a.name.localeCompare(b.name);
                            })
                            .map((team) => {
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

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </AdminLayout>
    </AdminRouteGuard>
  );
}
