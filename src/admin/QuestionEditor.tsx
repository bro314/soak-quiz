import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AdminLayout } from "./components/AdminLayout";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import type { Question, QuestionDetail, QuestionSecretAnswer } from "../types";
import { getQuestionLetter } from "../utils/question";


export function QuestionEditor() {
  const { eventId, roundId, questionId } = useParams<{ eventId: string; roundId: string; questionId: string }>();
  const navigate = useNavigate();

  // Data states
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit fields
  const [editNumber, setEditNumber] = useState(1);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<Question["type"]>("SINGLE_CHOICE");
  const [editStatus, setEditStatus] = useState<Question["status"]>("INACTIVE");
  const [editContent, setEditContent] = useState("");
  
  // Possible answers for MC (always keep 5 options for interface consistency)
  const [mcChoices, setMcChoices] = useState<string[]>(["", "", "", "", ""]);
  const [mcCorrectIndices, setMcCorrectIndices] = useState<number[]>([]);
  
  // Correct answer for Free text
  const [correctAnswerText, setCorrectAnswerText] = useState("");

  const [saving, setSaving] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // Snackbar toast state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    if (!eventId || !roundId || !questionId) return;

    setLoading(true);
    // Listen to Question doc
    const unsubQ = onSnapshot(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Omit<Question, "id">;
        setQuestion({ id: snap.id, ...data } as Question);
        setEditNumber(data.number);
        setEditTitle(data.title);
        setEditType(data.type);
        setEditStatus(data.status);
      } else {
        setError("Frage nicht gefunden.");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Fehler beim Laden der Frage: " + err.message);
      setLoading(false);
    });

    // Listen to Question detail
    const unsubDetail = onSnapshot(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/detail/main`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as QuestionDetail;
        setEditContent(data.content || "");
        if (data.possibleAnswers && data.possibleAnswers.length > 0) {
          // Fill options
          const filled = [...data.possibleAnswers];
          while (filled.length < 5) {
            filled.push("");
          }
          setMcChoices(filled);
        } else {
          setMcChoices(["", "", "", "", ""]);
        }
      }
    });

    // Listen to Secret answer
    const unsubSecret = onSnapshot(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/secret/answer`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as QuestionSecretAnswer;
        setCorrectAnswerText(data.correctAnswer || "");
      }
    });

    return () => {
      unsubQ();
      unsubDetail();
      unsubSecret();
    };
  }, [eventId, roundId, questionId]);

  // Set the mcCorrectIndices based on choices matching correct answer text
  useEffect(() => {
    if ((editType === "MULTIPLE_CHOICE" || editType === "SINGLE_CHOICE") && correctAnswerText) {
      const correctAnswers = correctAnswerText.split(",").map((s) => s.trim());
      const indices: number[] = [];
      mcChoices.forEach((choice, idx) => {
        if (choice && correctAnswers.includes(choice)) {
          indices.push(idx);
        }
      });
      setMcCorrectIndices(indices);
    } else {
      setMcCorrectIndices([]);
    }
  }, [mcChoices, correctAnswerText, editType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !roundId || !questionId || !question) return;
    setSaving(true);
    try {
      // Determine correct answer string
      let correct = correctAnswerText;
      let finalChoices: string[] = [];

      if (editType === "MULTIPLE_CHOICE" || editType === "SINGLE_CHOICE") {
        finalChoices = mcChoices.filter((c) => c.trim() !== "");
        if (editType === "SINGLE_CHOICE") {
          const firstIndex = mcCorrectIndices[0];
          correct = firstIndex !== undefined ? mcChoices[firstIndex] || "" : "";
        } else {
          const selected = mcCorrectIndices
            .sort((a, b) => a - b)
            .map((idx) => mcChoices[idx])
            .filter((val) => val && val.trim() !== "");
          correct = selected.join(",");
        }
      }

      await updateDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}`), {
        number: editNumber,
        title: editTitle,
        type: editType,
        status: editStatus,
      });

      await setDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/detail/main`), {
        content: editContent,
        possibleAnswers: finalChoices,
      });

      await setDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/secret/answer`), {
        correctAnswer: correct,
      });
      setSnackbar({ open: true, message: "Frage erfolgreich gespeichert.", severity: "success" });
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Speichern: " + err.message, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId || !roundId || !questionId) return;
    setOpenDeleteDialog(false);
    try {
      await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/detail/main`));
      await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}/secret/answer`));
      await deleteDoc(doc(db, `events/${eventId}/rounds/${roundId}/questions/${questionId}`));
      navigate(`/admin/event/${eventId}/round/${roundId}`);
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Löschen: " + err.message, severity: "error" });
    }
  };

  const handleMcChoiceChange = (index: number, val: string) => {
    const next = [...mcChoices];
    next[index] = val;
    setMcChoices(next);
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

  if (error || !question) {
    return (
      <AdminRouteGuard>
        <AdminLayout>
          <Alert severity="error">{error || "Frage nicht geladen."}</Alert>
        </AdminLayout>
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard>
      <AdminLayout>
        <Container maxWidth="md">
          <Button
            component={Link}
            to={`/admin/event/${eventId}/round/${roundId}`}
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 3 }}
          >
            Zurück zur Runde
          </Button>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              Frage {getQuestionLetter(question.number)} bearbeiten
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setOpenDeleteDialog(true)}
            >
              Frage löschen
            </Button>
          </Box>

          <Card className="glass" sx={{ p: 2 }}>
            <CardContent>
              <form onSubmit={handleSave}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Fragenummer"
                      type="number"
                      fullWidth
                      value={editNumber}
                      onChange={(e) => setEditNumber(Number(e.target.value))}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      label="Frage-Titel"
                      fullWidth
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Frage Beschreibung / Detail (optional)"
                      fullWidth
                      multiline
                      rows={4}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="z.B. siehe Präsentation oder ausformulierte Frage"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Status"
                      select
                      fullWidth
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Question["status"])}
                      slotProps={{
                        select: {
                          native: true,
                        },
                      }}
                    >
                      <option value="INACTIVE">Inaktiv (INACTIVE)</option>
                      <option value="ACTIVE">Aktiv (ACTIVE)</option>
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Fragentyp"
                      select
                      fullWidth
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as Question["type"])}
                      slotProps={{
                        select: {
                          native: true,
                        },
                      }}
                    >
                      <option value="SINGLE_CHOICE">Single Choice</option>
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="FREE_TEXT">Freitext</option>
                    </TextField>
                  </Grid>

                  {/* Single Choice / Multiple Choice Options */}
                  {(editType === "SINGLE_CHOICE" || editType === "MULTIPLE_CHOICE") && (
                    <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                        {editType === "SINGLE_CHOICE"
                          ? "Single Choice Antwortoptionen (und richtige Antwort auswählen)"
                          : "Multiple Choice Antwortoptionen (und richtige Antworten auswählen)"}
                      </Typography>
                      {mcChoices.map((choice, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
                          {editType === "SINGLE_CHOICE" ? (
                            <Radio
                              checked={mcCorrectIndices.includes(i)}
                              onChange={() => setMcCorrectIndices([i])}
                            />
                          ) : (
                            <Checkbox
                              checked={mcCorrectIndices.includes(i)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMcCorrectIndices((prev) => [...prev, i]);
                                } else {
                                  setMcCorrectIndices((prev) => prev.filter((idx) => idx !== i));
                                }
                              }}
                              color="secondary"
                            />
                          )}
                          <TextField
                            label={`Option ${i + 1}`}
                            fullWidth
                            value={choice}
                            onChange={(e) => handleMcChoiceChange(i, e.target.value)}
                            required={i < 2} // At least 2 options required
                          />
                        </Box>
                      ))}
                    </Grid>
                  )}

                  {/* Free Text Option */}
                  {editType === "FREE_TEXT" && (
                    <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                        Korrekte Antwort (Freitext)
                      </Typography>
                      <TextField
                        label="Richtige Antwort"
                        fullWidth
                        value={correctAnswerText}
                        onChange={(e) => setCorrectAnswerText(e.target.value)}
                        required
                        helperText="Groß-/Kleinschreibung und Sonderzeichen werden bei der automatischen Auswertung normalisiert."
                      />
                    </Grid>
                  )}

                  <Grid size={{ xs: 12 }} sx={{ mt: 3 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      disabled={saving}
                    >
                      {saving ? <CircularProgress size={24} /> : "Frage speichern"}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Container>

        {/* Delete Dialog */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle sx={{ fontWeight: 700 }}>Frage löschen?</DialogTitle>
          <DialogContent>
            Sicher, dass du diese Frage löschen möchtest? Das kann nicht rückgängig gemacht werden.
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Abbrechen</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
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
