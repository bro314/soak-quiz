import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, setDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
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
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Radio from "@mui/material/Radio";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { Round, Question, Team, Answer, Event } from "../types";

export function RoundEditor() {
  const { eventId, roundId } = useParams<{ eventId: string; roundId: string }>();
  const navigate = useNavigate();

  // Data states
  const [event, setEvent] = useState<Event | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit Round fields
  const [editNumber, setEditNumber] = useState(1);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<Round["status"]>("INACTIVE");
  const [savingRound, setSavingRound] = useState(false);

  // Create Question form state
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionType, setQuestionType] = useState<Question["type"]>("MULTIPLE_CHOICE");
  const [createQuestionLoading, setCreateQuestionLoading] = useState(false);

  // Dialogs
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Snackbar toast state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    if (!eventId || !roundId) return;

    setLoading(true);
    // Listen to Event doc
    const unsubEvent = onSnapshot(doc(db, `events/${eventId}`), (snap) => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...snap.data() } as Event);
      }
    });

    // Listen to Round doc
    const unsubRound = onSnapshot(doc(db, `events/${eventId}/rounds/${roundId}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Omit<Round, "id">;
        setRound({ id: snap.id, ...data } as Round);
        setEditNumber(data.number);
        setEditTitle(data.title);
        setEditStatus(data.status);
      } else {
        setError("Runde nicht gefunden.");
      }
    });

    // Listen to Round detail doc
    const unsubDetail = onSnapshot(doc(db, `events/${eventId}/rounds/${roundId}/detail/main`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEditDescription(data?.description || "");
      }
    });

    // Listen to Questions
    const unsubQuestions = onSnapshot(collection(db, `events/${eventId}/rounds/${roundId}/questions`), (snap) => {
      const list: Question[] = [];
      snap.forEach((d) => {
        const qData = d.data() as Omit<Question, "id">;
        list.push({ id: d.id, ...qData } as Question);
      });
      list.sort((a, b) => a.number - b.number);
      setQuestions(list);
    });

    // Listen to Teams
    const unsubTeams = onSnapshot(collection(db, `events/${eventId}/teams`), (snap) => {
      const list: Team[] = [];
      snap.forEach((d) => {
        const tData = d.data() as Omit<Team, "id">;
        list.push({ id: d.id, ...tData } as Team);
      });
      setTeams(list);
    });

    // Listen to Answers of this event
    const unsubAnswers = onSnapshot(collection(db, `events/${eventId}/answers`), (snap) => {
      const list: Answer[] = [];
      snap.forEach((d) => {
        const ans = d.data() as Omit<Answer, "id">;
        if (ans.roundId === roundId) {
          list.push({ id: d.id, ...ans } as Answer);
        }
      });
      setAnswers(list);
      setLoading(false);
    });

    return () => {
      unsubEvent();
      unsubRound();
      unsubDetail();
      unsubQuestions();
      unsubTeams();
      unsubAnswers();
    };
  }, [eventId, roundId]);

  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !roundId) return;
    setSavingRound(true);
    try {
      await updateDoc(doc(db, `events/${eventId}/rounds/${roundId}`), {
        number: editNumber,
        title: editTitle,
        status: editStatus,
      });
      await setDoc(doc(db, `events/${eventId}/rounds/${roundId}/detail/main`), {
        description: editDescription,
      });
      setSnackbar({ open: true, message: "Runde erfolgreich gespeichert.", severity: "success" });
      setOpenEditDialog(false);
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Speichern: " + err.message, severity: "error" });
    } finally {
      setSavingRound(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !roundId || !questionTitle) return;
    setCreateQuestionLoading(true);
    try {
      // Find smallest unused integer >= 1
      const numbers = questions.map((q) => q.number);
      let nextNumber = 1;
      while (numbers.includes(nextNumber)) {
        nextNumber++;
      }

      const questionId = `question-${nextNumber}`;
      const qRef = doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}`);
      const detailRef = doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/detail/main`);
      const secretRef = doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/secret/answer`);

      await setDoc(qRef, {
        number: nextNumber,
        type: questionType,
        title: questionTitle,
        status: "INACTIVE",
      });

      await setDoc(detailRef, {
        content: "",
        possibleAnswers: questionType === "MULTIPLE_CHOICE" ? ["", "", "", "", ""] : [],
      });

      await setDoc(secretRef, {
        correctAnswer: "",
      });

      setQuestionTitle("");
      navigate(`/admin/event/${eventId}/round/${roundId}/question/${questionId}`);
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Erstellen der Frage: " + err.message, severity: "error" });
    } finally {
      setCreateQuestionLoading(false);
    }
  };

  const handleDeleteRound = async () => {
    if (!eventId || !roundId) return;
    setOpenDeleteDialog(false);
    try {
      // Delete questions under round first (standard firestore client requires manual subcollection delete if not functions)
      const qSnaps = await getDocs(collection(db, `events/${eventId}/rounds/${roundId}/questions`));
      for (const qDoc of qSnaps.docs) {
        await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${qDoc.id}/detail/main`));
        await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${qDoc.id}/secret/answer`));
        await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${qDoc.id}`));
      }

      await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/detail/main`));
      await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}`));
      navigate(`/admin/event/${eventId}`);
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Löschen: " + err.message, severity: "error" });
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

  if (error || !round) {
    return (
      <AdminRouteGuard>
        <AdminLayout>
          <Alert severity="error">{error || "Runde nicht geladen."}</Alert>
        </AdminLayout>
      </AdminRouteGuard>
    );
  }

  // Create a mapping of teamId__roundId__questionId to Answer for easier score mapping
  const answerMap = new Map<string, Answer>(
    answers.map((a) => [`${a.teamId}__${a.roundId}__${a.questionId}`, a])
  );

  return (
    <AdminRouteGuard>
      <AdminLayout>
        <Container maxWidth="xl">
          <Button
            component={Link}
            to={`/admin/event/${eventId}`}
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 3 }}
          >
            Zurück zum Dashboard
          </Button>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              Runde {round.number}: {round.title}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setOpenEditDialog(true)}
              >
                Rundendetails bearbeiten
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setOpenDeleteDialog(true)}
              >
                Runde löschen
              </Button>
            </Box>
          </Box>

          {/* Fragenliste and Frage hinzufügen next to each other */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            {/* Fragenliste */}
            <Grid size={{ xs: 12, md: event?.status === "ACTIVE" ? 12 : 6 }}>
              <Card className="glass" sx={{ p: 2, height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                    Fragenliste
                  </Typography>
                  {questions.length === 0 ? (
                    <Typography color="text.secondary">Noch keine Fragen angelegt.</Typography>
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
                          {questions.map((q) => (
                             <TableRow
                               key={q.id}
                               hover
                               sx={{ cursor: "pointer" }}
                               onClick={() => navigate(`/admin/event/${eventId}/round/${roundId}/question/${q.id}`)}
                             >
                               <TableCell>{q.number}</TableCell>
                               <TableCell style={{ fontWeight: 600 }}>{q.title}</TableCell>
                               <TableCell>
                                 <Chip
                                   label={q.status}
                                   size="small"
                                   variant="outlined"
                                   color={q.status === "ACTIVE" ? "success" : "default"}
                                 />
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

            {/* Create Question Card */}
            {event?.status !== "ACTIVE" && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card className="glass" sx={{ p: 2, height: "100%" }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                      Frage hinzufügen
                    </Typography>
                    <form onSubmit={handleCreateQuestion}>
                      <TextField
                        label="Frage-Titel"
                        fullWidth
                        variant="outlined"
                        value={questionTitle}
                        onChange={(e) => setQuestionTitle(e.target.value)}
                        sx={{ mb: 2 }}
                        required
                      />
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Fragentyp:
                        </Typography>
                        <FormControlLabel
                          control={
                            <Radio
                              checked={questionType === "MULTIPLE_CHOICE"}
                              onChange={() => setQuestionType("MULTIPLE_CHOICE")}
                            />
                          }
                          label="Multiple Choice"
                        />
                        <FormControlLabel
                          control={
                            <Radio
                              checked={questionType === "FREE_TEXT"}
                              onChange={() => setQuestionType("FREE_TEXT")}
                            />
                          }
                          label="Freitext (Normalisiert)"
                        />
                      </Box>

                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        startIcon={<AddIcon />}
                        disabled={createQuestionLoading}
                      >
                        Frage erstellen
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Round Score Table */}
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <Card className="glass" sx={{ p: 2 }}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                    Spielstand für Runde {round.number}
                  </Typography>
                  {teams.length === 0 ? (
                    <Typography color="text.secondary">Noch keine Teams registriert.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ bgcolor: "transparent", backgroundImage: "none" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Team Name</TableCell>
                            {questions.map((q) => (
                              <TableCell key={q.id} align="right" sx={{ fontWeight: 700 }}>
                                F{q.number}
                              </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              Gesamt
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {teams.map((team) => (
                            <TableRow key={team.id}>
                              <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                                {team.name}
                              </TableCell>
                              {questions.map((q) => {
                                const ans = answerMap.get(`${team.id}__${roundId}__${q.id}`);
                                return (
                                  <TableCell key={q.id} align="right">
                                    {ans ? (
                                      <Chip
                                        label={ans.points}
                                        size="small"
                                        color={ans.validated ? "success" : "warning"}
                                        variant="outlined"
                                      />
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell align="right" sx={{ fontWeight: 700, color: "secondary.main" }}>
                                {questions.reduce((sum, q) => sum + (answerMap.get(`${team.id}__${roundId}__${q.id}`)?.points ?? 0), 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ "& td, & th": { fontWeight: 700, borderTop: "2px dashed rgba(255, 255, 255, 0.15)" } }}>
                            <TableCell>Gesamt</TableCell>
                            {questions.map((q) => {
                              const totalQuestionPoints = teams.reduce((sum, team) => {
                                const ans = answerMap.get(`${team.id}__${roundId}__${q.id}`);
                                return sum + (ans?.points ?? 0);
                              }, 0);
                              return (
                                <TableCell key={q.id} align="right">
                                  {totalQuestionPoints}
                                </TableCell>
                              );
                            })}
                            <TableCell align="right" sx={{ color: "primary.main" }}>
                              {teams.reduce((sum, team) => {
                                return sum + questions.reduce((qSum, q) => qSum + (answerMap.get(`${team.id}__${roundId}__${q.id}`)?.points ?? 0), 0);
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

        {/* Edit Round Dialog */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Rundendetails bearbeiten</DialogTitle>
          <form onSubmit={handleSaveRound}>
            <DialogContent>
              <TextField
                label="Rundennummer"
                type="number"
                fullWidth
                variant="outlined"
                value={editNumber}
                onChange={(e) => setEditNumber(Number(e.target.value))}
                sx={{ mb: 2, mt: 1 }}
                required
              />
              <TextField
                label="Titel"
                fullWidth
                variant="outlined"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                label="Beschreibung"
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Rundenstatus"
                select
                fullWidth
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as Round["status"])}
                slotProps={{
                  select: {
                    native: true,
                  },
                }}
                sx={{ mb: 1 }}
              >
                <option value="INACTIVE">Inaktiv (INACTIVE)</option>
                <option value="ACTIVE">Aktiv (ACTIVE)</option>
                <option value="VALIDATION">Validierung (VALIDATION)</option>
                <option value="DONE">Beendet (DONE)</option>
              </TextField>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setOpenEditDialog(false)}>Abbrechen</Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={savingRound}
              >
                {savingRound ? <CircularProgress size={24} /> : "Runde speichern"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle sx={{ fontWeight: 700 }}>Runde löschen?</DialogTitle>
          <DialogContent>
            Sicher, dass du diese Runde und all ihre Fragen löschen möchtest? Das kann nicht rückgängig gemacht werden.
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Abbrechen</Button>
            <Button onClick={handleDeleteRound} color="error" variant="contained">
              Löschen
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
