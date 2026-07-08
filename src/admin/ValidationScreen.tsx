import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AdminLayout } from "./components/AdminLayout";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import type { Answer, Question, Round } from "../types";
import { getQuestionLetter } from "../utils/question";
function truncate(str: string, maxLength: number = 16): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

export function ValidationScreen() {
  const { eventId } = useParams<{ eventId: string }>();

  // Data states
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Map<string, Question>>(new Map());
  const [secretAnswersMap, setSecretAnswersMap] = useState<Map<string, string>>(new Map());
  const [teamsMap, setTeamsMap] = useState<Map<string, string>>(new Map()); // teamId -> name
  const [roundsMap, setRoundsMap] = useState<Map<string, Round>>(new Map());
  const [loading, setLoading] = useState(true);

  // Point modifications state
  const [editPoints, setEditPoints] = useState<{ [answerId: string]: string }>({});
  const [actionLoading, setActionLoading] = useState<{ [answerId: string]: boolean }>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "error",
  });

  const handlePointsChange = (answerId: string, val: string) => {
    setEditPoints((prev) => ({ ...prev, [answerId]: val }));
  };

  useEffect(() => {
    if (!eventId) return;

    setLoading(true);

    // Listen to teams
    const unsubTeams = onSnapshot(collection(db, `events/${eventId}/teams`), (snap) => {
      const tMap = new Map<string, string>();
      snap.forEach((d) => {
        tMap.set(d.id, d.data().name || d.id);
      });
      setTeamsMap(tMap);
    });

    // Listen to rounds
    const unsubRounds = onSnapshot(collection(db, `events/${eventId}/rounds`), (snap) => {
      const rMap = new Map<string, Round>();
      snap.forEach((d) => {
        rMap.set(d.id, { id: d.id, ...d.data() } as Round);
      });
      setRoundsMap(rMap);
    });

    // Listen to answers
    const unsubAnswers = onSnapshot(collection(db, `events/${eventId}/answers`), async (snap) => {
      const list: Answer[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Answer, "id">;
        if (!data.validated) {
          list.push({ id: d.id, ...data } as Answer);
        }
      });

      const getTime = (ts: any) => {
        if (!ts) return 0;
        if (typeof ts.toMillis === "function") return ts.toMillis();
        if (typeof ts.seconds === "number") return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === "number") return ts;
        if (typeof ts === "string") return new Date(ts).getTime();
        return 0;
      };

      list.sort((a, b) => getTime(a.submittedAt) - getTime(b.submittedAt));
      setAnswers(list);
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubRounds();
      unsubAnswers();
    };
  }, [eventId]);

  // Load question and secret answer details for unvalidated answers
  useEffect(() => {
    if (!eventId || answers.length === 0) return;

    const loadQuestionData = async () => {
      const qMap = new Map(questionsMap);
      const sMap = new Map(secretAnswersMap);
      let updated = false;

      for (const ans of answers) {
        const cacheKey = `${ans.roundId}__${ans.questionId}`;

        // Load question details
        if (!qMap.has(cacheKey)) {
          try {
            const qSnap = await getDoc(doc(db, `events/${eventId}/rounds/${ans.roundId}/questions/${ans.questionId}`));
            if (qSnap.exists()) {
              qMap.set(cacheKey, qSnap.data() as Question);
              updated = true;
            }
          } catch (err) {
            console.error("Error loading question:", err);
          }
        }

        // Load correct answer
        if (!sMap.has(cacheKey)) {
          try {
            const sSnap = await getDoc(doc(db, `events/${eventId}/rounds/${ans.roundId}/questions/${ans.questionId}/secret/answer`));
            if (sSnap.exists()) {
              sMap.set(cacheKey, sSnap.data().correctAnswer || "");
              updated = true;
            }
          } catch (err) {
            console.error("Error loading secret answer:", err);
          }
        }
      }

      if (updated) {
        setQuestionsMap(qMap);
        setSecretAnswersMap(sMap);
      }
    };

    loadQuestionData();
  }, [eventId, answers]);

  // Initialize editPoints local state when answers list changes
  useEffect(() => {
    const next: typeof editPoints = {};
    answers.forEach((ans) => {
      if (editPoints[ans.id] === undefined) {
        next[ans.id] = String(ans.points);
      } else {
        next[ans.id] = editPoints[ans.id];
      }
    });
    setEditPoints((prev) => ({ ...prev, ...next }));
  }, [answers]);

  const handleValidate = async (ans: Answer, customPoints?: number) => {
    if (!eventId) return;
    const pts = customPoints !== undefined ? customPoints : Number(editPoints[ans.id]);
    if (isNaN(pts)) {
      setSnackbar({ open: true, message: "Punkte müssen eine Zahl sein.", severity: "error" });
      return;
    }

    setActionLoading((prev) => ({ ...prev, [ans.id]: true }));
    try {
      await updateDoc(doc(db, `events/${eventId}/answers/${ans.id}`), {
        points: pts,
        validated: true,
      });

      // Check if this was the last unvalidated answer for this round in the current state
      const roundId = ans.roundId;
      const remainingForRound = answers.filter((a) => a.roundId === roundId && a.id !== ans.id);
      const r = roundsMap.get(roundId);
      if (remainingForRound.length === 0 && r?.status === "VALIDATION") {
        await updateDoc(doc(db, `events/${eventId}/rounds/${roundId}`), {
          status: "DONE",
        });
      }
    } catch (err: any) {
      console.error(err);
      setSnackbar({ open: true, message: "Fehler beim Validieren: " + err.message, severity: "error" });
    } finally {
      setActionLoading((prev) => ({ ...prev, [ans.id]: false }));
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

  return (
    <AdminRouteGuard>
      <AdminLayout>
        <Container maxWidth={false}>
          <Button
            component={Link}
            to={`/admin/event/${eventId}`}
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 3 }}
          >
            Zurück zum Dashboard
          </Button>

          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800, mb: 4 }}>
            Freitext-Fragen validieren
          </Typography>

          <Card className="glass" sx={{ p: 2 }}>
            <CardContent>
              {answers.length === 0 ? (
                <Typography color="text.secondary">
                  Aktuell gibt es keine Freitext-Antworten, die validiert werden müssen.
                </Typography>
              ) : (
                <TableContainer component={Paper} sx={{ bgcolor: "transparent", backgroundImage: "none" }}>
                  <Table sx={{ "& .MuiTableCell-root": { fontSize: "1.05rem", py: 1, px: 1.5, whiteSpace: "nowrap" } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Frage</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell>Titel</TableCell>
                        <TableCell sx={{ width: 250, minWidth: 250 }}>Soll</TableCell>
                        <TableCell sx={{ width: 250, minWidth: 250 }}>Ist</TableCell>
                        <TableCell align="left" sx={{ width: "100%" }}>Aktionen</TableCell>
                        <TableCell align="right">Manuell</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {answers.map((ans) => {
                        const cacheKey = `${ans.roundId}__${ans.questionId}`;
                        const q = questionsMap.get(cacheKey);
                        const r = roundsMap.get(ans.roundId);
                        const correctAns = secretAnswersMap.get(cacheKey) || "";
                        const teamName = teamsMap.get(ans.teamId) || ans.teamId;
                        const isPtsInvalid = isNaN(Number(editPoints[ans.id])) || editPoints[ans.id]?.trim() === "";

                        return (
                          <TableRow key={ans.id}>
                            <TableCell>
                              R{r?.number || "—"} / {q?.number ? getQuestionLetter(q.number) : "—"}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              <span title={teamName}>
                                {truncate(teamName)}
                              </span>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              <span title={q?.title || "Frage wird geladen..."}>
                                {truncate(q?.title || "Frage wird geladen...")}
                              </span>
                            </TableCell>
                            <TableCell color="text.secondary" sx={{ width: 250, minWidth: 250, maxWidth: 250, whiteSpace: "normal" }}>
                              <Box sx={{ width: 250, whiteSpace: "normal", wordBreak: "break-word" }}>
                                {correctAns}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ color: "secondary.main", fontWeight: 600, width: 250, minWidth: 250, maxWidth: 250, whiteSpace: "normal" }}>
                              <Box sx={{ width: 250, whiteSpace: "normal", wordBreak: "break-word" }}>
                                {ans.answerText}
                              </Box>
                            </TableCell>
                            <TableCell align="left">
                              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-start" }}>
                                {[1, 0.5, 0].map((score) => {
                                  const isSuggested = ans.points === score;
                                  return (
                                    <Button
                                      key={score}
                                      variant={isSuggested ? "contained" : "outlined"}
                                      color="primary"
                                      size="small"
                                      onClick={() => handleValidate(ans, score)}
                                      disabled={actionLoading[ans.id]}
                                      sx={{ fontSize: "1.05rem", minWidth: "80px" }}
                                    >
                                      {score === 0.5 ? "0,5" : score}
                                    </Button>
                                  );
                                })}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "flex-end" }}>
                                <TextField
                                  variant="standard"
                                  size="small"
                                  type="number"
                                  slotProps={{
                                    htmlInput: {
                                      step: 0.5,
                                      min: 0,
                                      style: { width: "60px", fontSize: "1.05rem", textAlign: "center" }
                                    },
                                  }}
                                  value={editPoints[ans.id] || ""}
                                  onChange={(e) => handlePointsChange(ans.id, e.target.value)}
                                  error={isPtsInvalid}
                                  helperText={isPtsInvalid ? "Ungültige" : ""}
                                  sx={{ m: 0 }}
                                />
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  size="small"
                                  onClick={() => handleValidate(ans)}
                                  disabled={actionLoading[ans.id] || isPtsInvalid}
                                  sx={{ fontSize: "1.05rem" }}
                                >
                                  {actionLoading[ans.id] ? <CircularProgress size={20} /> : "Speichern"}
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
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
        </Container>
      </AdminLayout>
    </AdminRouteGuard>
  );
}
