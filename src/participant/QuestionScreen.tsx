import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useClaims } from "../hooks/useClaims";
import type { Round, Question, QuestionDetail, Answer } from "../types";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";

export function QuestionScreen() {
  const { eventId, roundId, questionId } = useParams<{ eventId: string; roundId: string; questionId: string }>();
  const navigate = useNavigate();
  const { claims, loading: claimsLoading } = useClaims();

  const [round, setRound] = useState<Round | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [existingAnswer, setExistingAnswer] = useState<Answer | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAuthorized = claims.role === "team" && claims.eventId === eventId;
  const teamId = claims.teamId;

  useEffect(() => {
    if (claimsLoading) return;
    if (!isAuthorized) {
      navigate(`/event/${eventId}`);
    }
  }, [isAuthorized, claimsLoading, eventId, navigate]);

  // Listen to list of questions in the round for navigation
  useEffect(() => {
    if (!eventId || !roundId) return;
    const questionsRef = collection(db, "events", eventId, "rounds", roundId, "questions");
    const unsubList = onSnapshot(questionsRef, (snapshot) => {
      const list: Question[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Question);
      });
      list.sort((a, b) => a.number - b.number);
      setQuestionsList(list);
    });
    return unsubList;
  }, [eventId, roundId]);

  useEffect(() => {
    if (!eventId || !roundId || !questionId || !teamId || !isAuthorized) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setDetail(null);

    // Listen to round status
    const roundRef = doc(db, "events", eventId, "rounds", roundId);
    const unsubRound = onSnapshot(roundRef, (docSnap) => {
      if (docSnap.exists()) {
        setRound({ id: docSnap.id, ...docSnap.data() } as Round);
      }
    });

    // Listen to question status
    const questionRef = doc(db, "events", eventId, "rounds", roundId, "questions", questionId);
    const unsubQuestion = onSnapshot(questionRef, (docSnap) => {
      if (docSnap.exists()) {
        const qData = { id: docSnap.id, ...docSnap.data() } as Question;
        setQuestion(qData);
        if (qData.status !== "ACTIVE") {
          setLoading(false);
        }
      } else {
        setError("Frage nicht gefunden.");
        setLoading(false);
      }
    });

    // Listen to question details (only accessible if active)
    const detailRef = doc(db, "events", eventId, "rounds", roundId, "questions", questionId, "detail", "main");
    const unsubDetail = onSnapshot(
      detailRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setDetail(docSnap.data() as QuestionDetail);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Could not read question detail (expected if inactive).", err);
        setLoading(false);
      }
    );

    // Listen to our existing answer
    const answerRef = doc(db, "events", eventId, "answers", `${teamId}__${questionId}`);
    const unsubAnswer = onSnapshot(answerRef, (docSnap) => {
      if (docSnap.exists()) {
        const ans = { id: docSnap.id, ...docSnap.data() } as Answer;
        setExistingAnswer(ans);
        setAnswerInput(ans.answerText);
      } else {
        setExistingAnswer(null);
        setAnswerInput("");
      }
    });

    return () => {
      unsubRound();
      unsubQuestion();
      unsubDetail();
      unsubAnswer();
    };
  }, [eventId, roundId, questionId, teamId, isAuthorized]);

  // Immediately clear answers when switching questions to prevent prefilling state leaks
  useEffect(() => {
    setExistingAnswer(null);
    setAnswerInput("");
    setError("");
    setSuccess("");
  }, [questionId]);


  const handleSaveAnswer = async (valToSave?: string) => {
    if (!eventId || !roundId || !questionId || !teamId) return;
    const finalVal = valToSave !== undefined ? valToSave : answerInput;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const answerDocRef = doc(db, "events", eventId, "answers", `${teamId}__${questionId}`);
      await setDoc(answerDocRef, {
        teamId,
        roundId,
        questionId,
        answerText: finalVal,
        submittedAt: serverTimestamp(),
        points: existingAnswer ? existingAnswer.points : 0,
        validated: existingAnswer ? existingAnswer.validated : false,
      });
      setSuccess("Antwort gespeichert.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Fehler beim Speichern der Antwort.");
    } finally {
      setSaving(false);
    }
  };

  if (claimsLoading || loading) {
    return (
      <Container sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress color="secondary" />
      </Container>
    );
  }

  // Find current index in list to enable Next/Prev buttons
  const currentIndex = questionsList.findIndex((q) => q.id === questionId);
  const prevQuestion = currentIndex > 0 ? questionsList[currentIndex - 1] : null;
  const nextQuestion = currentIndex !== -1 && currentIndex < questionsList.length - 1 ? questionsList[currentIndex + 1] : null;

  const isQuestionActive = question?.status === "ACTIVE";
  const isRoundActive = round?.status === "ACTIVE";
  const canAnswer = isQuestionActive && isRoundActive;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        component={Link}
        to={`/event/${eventId}/round/${roundId}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Zurück zur Runde
      </Button>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      {!isQuestionActive && (
        <Alert severity="info" sx={{ mb: 3, fontWeight: 600 }}>
          Frage noch nicht freigeschaltet. Bitte warte, bis der Spielleiter diese Frage aktiviert.
        </Alert>
      )}

      {isQuestionActive && question && (
        <Card className="glass" sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="caption" color="secondary" sx={{ fontWeight: 650, display: "block", mb: 1 }}>
              Runde {round?.number} • Frage {question.number}
            </Typography>
            <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 800, mb: 3 }}>
              {question.title}
            </Typography>

            <Typography variant="body1" sx={{ mb: 4, whiteSpace: "pre-wrap" }}>
              {detail?.content || "Siehe Präsentation des Spielleiters."}
            </Typography>

            {/* Answer Options */}
            {canAnswer ? (
              <Box sx={{ mt: 2 }}>
                {question.type === "MULTIPLE_CHOICE" ? (
                  <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                      value={answerInput}
                      onChange={(e) => {
                        setAnswerInput(e.target.value);
                        handleSaveAnswer(e.target.value);
                      }}
                    >
                      {detail?.possibleAnswers?.map((ansOpt, idx) => (
                        <FormControlLabel
                          key={idx}
                          value={ansOpt}
                          control={<Radio color="secondary" />}
                          label={ansOpt}
                          sx={{
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: 2,
                            p: 1.5,
                            mb: 2,
                            width: "100%",
                            marginLeft: 0,
                            marginRight: 0,
                            "&:hover": {
                              backgroundColor: "rgba(124, 77, 255, 0.08)",
                            },
                          }}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <TextField
                      label="Deine Antwort"
                      variant="outlined"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      color="secondary"
                      size="large"
                      startIcon={<SaveIcon />}
                      onClick={() => handleSaveAnswer()}
                      disabled={saving}
                      fullWidth
                    >
                      {saving ? <CircularProgress size={24} color="inherit" /> : "Antwort absenden"}
                    </Button>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ mt: 2, p: 2, borderRadius: 2, backgroundColor: "rgba(255, 255, 255, 0.04)", border: "1px dashed rgba(255, 255, 255, 0.1)" }}>
                <Typography variant="body2" color="text.secondary">
                  {!isRoundActive
                    ? "Runde geschlossen. Antwort kann nicht mehr geändert werden."
                    : "Frage gesperrt."}
                </Typography>
                {existingAnswer && (
                  <Typography variant="body1" sx={{ mt: 1.5, fontWeight: 600 }}>
                    Eingereichte Antwort: {existingAnswer.answerText}
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
        <Button
          component={Link}
          to={prevQuestion ? `/event/${eventId}/round/${roundId}/question/${prevQuestion.id}` : "#"}
          disabled={!prevQuestion}
          startIcon={<NavigateBeforeIcon />}
        >
          Vorherige
        </Button>
        <Button
          component={Link}
          to={nextQuestion ? `/event/${eventId}/round/${roundId}/question/${nextQuestion.id}` : "#"}
          disabled={!nextQuestion}
          endIcon={<NavigateNextIcon />}
        >
          Nächste
        </Button>
      </Box>
    </Container>
  );
}
