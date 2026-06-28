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
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { Answer, Question, Round } from "../types";

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

  const handleValidate = async (ans: Answer) => {
    if (!eventId) return;
    const pts = Number(editPoints[ans.id]);
    if (isNaN(pts)) {
      alert("Punkte müssen eine Zahl sein.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [ans.id]: true }));
    try {
      await updateDoc(doc(db, `events/${eventId}/answers/${ans.id}`), {
        points: pts,
        validated: true,
      });
    } catch (err: any) {
      console.error(err);
      alert("Fehler beim Validieren: " + err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [ans.id]: false }));
    }
  };

  const handlePointsChange = (answerId: string, val: string) => {
    setEditPoints((prev) => ({ ...prev, [answerId]: val }));
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
        <Container maxWidth="xl">
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
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Runde / Frage</TableCell>
                        <TableCell>Frage-Titel</TableCell>
                        <TableCell>Soll-Antwort</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell>Ist-Antwort</TableCell>
                        <TableCell sx={{ width: 120 }}>Punkte</TableCell>
                        <TableCell align="right">Aktion</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {answers.map((ans) => {
                        const cacheKey = `${ans.roundId}__${ans.questionId}`;
                        const q = questionsMap.get(cacheKey);
                        const r = roundsMap.get(ans.roundId);
                        const correctAns = secretAnswersMap.get(cacheKey) || "";
                        const teamName = teamsMap.get(ans.teamId) || ans.teamId;

                        return (
                          <TableRow key={ans.id}>
                            <TableCell>
                              R{r?.number || "—"} / F{q?.number || "—"}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{q?.title || "Frage wird geladen..."}</TableCell>
                            <TableCell color="text.secondary">{correctAns}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{teamName}</TableCell>
                            <TableCell sx={{ color: "secondary.main", fontWeight: 600 }}>
                              {ans.answerText}
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                slotProps={{
                                  htmlInput: {
                                    step: 0.5,
                                    min: 0,
                                  },
                                }}
                                value={editPoints[ans.id] || ""}
                                onChange={(e) => handlePointsChange(ans.id, e.target.value)}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => handleValidate(ans)}
                                disabled={actionLoading[ans.id]}
                              >
                                {actionLoading[ans.id] ? <CircularProgress size={20} /> : "OK"}
                              </Button>
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
        </Container>
      </AdminLayout>
    </AdminRouteGuard>
  );
}
