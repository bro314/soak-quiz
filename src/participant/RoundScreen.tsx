import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useClaims } from "../hooks/useClaims";
import type { Round, RoundDetail, Question, Answer } from "../types";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpIcon from "@mui/icons-material/Help";

export function RoundScreen() {
  const { eventId, roundId } = useParams<{ eventId: string; roundId: string }>();
  const navigate = useNavigate();
  const { claims, loading: claimsLoading } = useClaims();

  const [round, setRound] = useState<Round | null>(null);
  const [detail, setDetail] = useState<RoundDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [challenging, setChallenging] = useState<Record<string, boolean>>({});

  const isAuthorized = claims.role === "team" && claims.eventId === eventId;
  const teamId = claims.teamId;

  const handleChallenge = async (questionId: string) => {
    if (!eventId || !teamId || !roundId) return;
    setChallenging(prev => ({ ...prev, [questionId]: true }));
    setError("");
    try {
      const answerId = `${teamId}__${roundId}__${questionId}`;
      const answerRef = doc(db, "events", eventId, "answers", answerId);
      await updateDoc(answerRef, {
        points: 0,
        validated: false,
      });
    } catch (err: any) {
      console.error("Error challenging answer", err);
      setError("Fehler beim Einreichen des Einspruchs.");
    } finally {
      setChallenging(prev => ({ ...prev, [questionId]: false }));
    }
  };

  useEffect(() => {
    if (claimsLoading) return;
    if (!isAuthorized) {
      navigate(`/event/${eventId}`);
    }
  }, [isAuthorized, claimsLoading, eventId, navigate]);

  useEffect(() => {
    if (!eventId || !roundId || !teamId || !isAuthorized) return;

    // Listen to round document
    const roundRef = doc(db, "events", eventId, "rounds", roundId);
    const unsubRound = onSnapshot(roundRef, (docSnap) => {
      if (docSnap.exists()) {
        const roundData = { id: docSnap.id, ...docSnap.data() } as Round;
        setRound(roundData);

        if (roundData.status === "INACTIVE") {
          setError("Diese Runde ist momentan inaktiv.");
          setLoading(false);
        }
      } else {
        setError("Runde nicht gefunden.");
        setLoading(false);
      }
    });

    // Listen to questions in round
    const questionsRef = collection(db, "events", eventId, "rounds", roundId, "questions");
    const unsubQuestions = onSnapshot(questionsRef, (snapshot) => {
      const list: Question[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Question);
      });
      list.sort((a, b) => a.number - b.number);
      setQuestions(list);
    });

    // Listen to our team's answers for this round
    const q = query(
      collection(db, "events", eventId, "answers"),
      where("teamId", "==", teamId),
      where("roundId", "==", roundId)
    );
    const unsubAnswers = onSnapshot(q, (snapshot) => {
      const ansMap: Record<string, Answer> = {};
      snapshot.forEach((d) => {
        const ans = { id: d.id, ...d.data() } as Answer;
        ansMap[ans.questionId] = ans;
      });
      setAnswers(ansMap);
      setLoading(false);
    }, (err) => {
      console.error("Answers subscription error", err);
      setLoading(false);
    });

    return () => {
      unsubRound();
      unsubQuestions();
      unsubAnswers();
    };
  }, [eventId, roundId, teamId, isAuthorized]);

  // Listen to round details main document (only accessible if active/done)
  useEffect(() => {
    if (!eventId || !roundId || !isAuthorized || round?.status === "INACTIVE") {
      setDetail(null);
      return;
    }

    const detailRef = doc(db, "events", eventId, "rounds", roundId, "detail", "main");
    const unsubDetail = onSnapshot(
      detailRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setDetail(docSnap.data() as RoundDetail);
        }
      },
      (err) => {
        console.warn("Could not read round detail (expected if round is inactive).", err);
      }
    );

    return () => {
      unsubDetail();
    };
  }, [eventId, roundId, isAuthorized, round?.status]);

  if (claimsLoading || loading) {
    return (
      <Container sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress color="secondary" />
      </Container>
    );
  }

  const isInactiveRound = round?.status === "INACTIVE";

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        component={Link}
        to={`/event/${eventId}/home`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Zurück zur Übersicht
      </Button>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!isInactiveRound && round && (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800 }}>
              Runde {round.number}: {round.title}
            </Typography>
            {detail?.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {detail.description}
              </Typography>
            )}
          </Box>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Fragen
          </Typography>

          <List sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
            {questions.map((qItem) => {
              const isQuestionActive = qItem.status === "ACTIVE";
              const isAnswered = !!answers[qItem.id];

              return (
                <Card key={qItem.id} variant="outlined" sx={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <ListItem disablePadding>
                    <ListItemButton
                      component={Link}
                      to={`/event/${eventId}/round/${roundId}/question/${qItem.id}`}
                      sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 650 }}>
                            Frage {qItem.number}: {qItem.title}
                          </Typography>
                        }
                        secondary={
                          isAnswered
                            ? `Beantwortet: ${answers[qItem.id].answerText}`
                            : isQuestionActive
                              ? "Offen"
                              : "Gesperrt"
                        }
                      />
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {round?.status === "DONE" && (
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                              {answers[qItem.id]?.points ?? 0} Pkt.
                            </Typography>
                          )}
                          {isAnswered && <CheckCircleIcon color="success" />}
                          {!isAnswered && isQuestionActive && <HelpIcon color="secondary" />}
                          {!isQuestionActive && <LockIcon color="disabled" />}
                        </Box>
                        {round?.status === "DONE" && isAnswered && (
                          <Box>
                            {answers[qItem.id]?.validated === false ? (
                              <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 650 }}>
                                In Prüfung
                              </Typography>
                            ) : (
                              <Button
                                size="small"
                                variant="text"
                                color="warning"
                                sx={{ py: 0, minWidth: 0, textTransform: "none", fontSize: "0.75rem", fontWeight: 650 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleChallenge(qItem.id);
                                }}
                                disabled={challenging[qItem.id]}
                              >
                                Einspruch
                              </Button>
                            )}
                          </Box>
                        )}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                </Card>
              );
            })}
          </List>
        </>
      )}
    </Container>
  );
}
