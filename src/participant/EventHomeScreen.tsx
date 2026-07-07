import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useClaims } from "../hooks/useClaims";
import type { Event, Round, Scoreboard } from "../types";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import Paper from "@mui/material/Paper";
import ListItemButton from "@mui/material/ListItemButton";
import CircularProgress from "@mui/material/CircularProgress";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";

export function EventHomeScreen() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { claims, loading: claimsLoading } = useClaims();

  const [event, setEvent] = useState<Event | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [scoreboardList, setScoreboardList] = useState<Scoreboard[]>([]);
  const [teamScore, setTeamScore] = useState<Scoreboard | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamsMap, setTeamsMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Unauthorized if role is not team or eventId does not match
  const isAuthorized = claims.role === "team" && claims.eventId === eventId;
  const teamId = claims.teamId;

  useEffect(() => {
    if (claimsLoading) return;
    if (!isAuthorized) {
      navigate(`/event/${eventId}`);
    }
  }, [isAuthorized, claimsLoading, eventId, navigate]);

  useEffect(() => {
    if (!eventId || !teamId || !isAuthorized) return;

    // Listen to event
    const eventRef = doc(db, "events", eventId);
    const unsubEvent = onSnapshot(eventRef, (docSnap) => {
      if (docSnap.exists()) {
        setEvent({ id: docSnap.id, ...docSnap.data() } as Event);
      }
    });

    // Listen to team details
    const teamRef = doc(db, "events", eventId, "teams", teamId);
    const unsubTeam = onSnapshot(teamRef, (docSnap) => {
      if (docSnap.exists()) {
        setTeamName(docSnap.data().name);
      }
    });

    // Listen to rounds
    const roundsRef = collection(db, "events", eventId, "rounds");
    const unsubRounds = onSnapshot(roundsRef, (snapshot) => {
      const list: Round[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Round);
      });
      list.sort((a, b) => a.number - b.number);
      setRounds(list);
    });

    // Listen to own team scoreboard doc
    const scoreRef = doc(db, "events", eventId, "scoreboard", teamId);
    const unsubOwnScore = onSnapshot(scoreRef, (docSnap) => {
      if (docSnap.exists()) {
        setTeamScore({ teamId: docSnap.id, ...docSnap.data() } as Scoreboard);
      }
    });

    // Listen to all scoreboards to compute placement
    const scoreboardRef = collection(db, "events", eventId, "scoreboard");
    const unsubScoreboard = onSnapshot(scoreboardRef, (snapshot) => {
      const list: Scoreboard[] = [];
      snapshot.forEach((d) => {
        list.push({ teamId: d.id, ...d.data() } as Scoreboard);
      });
      // Sort descending by total score
      list.sort((a, b) => b.total - a.total);
      setScoreboardList(list);
      setLoading(false);
    }, (err) => {
      console.error("Scoreboard subscription error", err);
      setLoading(false);
    });

    // Listen to all teams for names
    const teamsRef = collection(db, "events", eventId, "teams");
    const unsubTeams = onSnapshot(teamsRef, (snapshot) => {
      const map = new Map<string, string>();
      snapshot.forEach((d) => {
        map.set(d.id, d.data().name);
      });
      setTeamsMap(map);
    });

    return () => {
      unsubEvent();
      unsubTeam();
      unsubRounds();
      unsubOwnScore();
      unsubScoreboard();
      unsubTeams();
    };
  }, [eventId, teamId, isAuthorized]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Wait for auth listener to re-authenticate anonymously, then navigate
      navigate(`/event/${eventId}`);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (claimsLoading || loading) {
    return (
      <Container sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress color="secondary" />
      </Container>
    );
  }

  // Calculate placement and total points based only on DONE rounds to avoid spoilers
  const doneRoundIds = new Set(
    rounds.filter((r) => r.status === "DONE").map((r) => r.id)
  );

  const getDoneTotal = (score: Scoreboard | null) => {
    if (!score || !score.perRound) return 0;
    return Object.entries(score.perRound).reduce((sum, [rId, pts]) => {
      if (doneRoundIds.has(rId)) {
        return sum + (Number(pts) || 0);
      }
      return sum;
    }, 0);
  };

  const sortedScoreboardList = [...scoreboardList].sort(
    (a, b) => getDoneTotal(b) - getDoneTotal(a)
  );

  const placementIndex = sortedScoreboardList.findIndex((s) => s.teamId === teamId);
  const placement = placementIndex !== -1 ? placementIndex + 1 : null;
  const totalRankedTeams = sortedScoreboardList.length;
  const displayTotal = teamScore ? getDoneTotal(teamScore) : 0;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 800 }}>
            {event?.name || "SoAk Quiz"}
          </Typography>
          <Typography variant="subtitle2" color="secondary">
            Eingeloggt als: {teamName}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            component={Link}
            to={`/event/${eventId}/settings`}
            variant="outlined"
            color="primary"
            size="small"
            sx={{ minWidth: 0, p: 1 }}
          >
            <SettingsIcon />
          </Button>
          <Button
            onClick={handleLogout}
            variant="outlined"
            color="error"
            size="small"
            sx={{ minWidth: 0, p: 1 }}
          >
            <LogoutIcon />
          </Button>
        </Box>
      </Box>

      {event?.status === "INACTIVE" ? (
        placement && (
          <Card className="glass" sx={{ mb: 4, background: "linear-gradient(135deg, rgba(124, 77, 255, 0.15) 0%, rgba(0, 229, 255, 0.05) 100%)" }}>
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
              <EmojiEventsIcon sx={{ fontSize: 40, color: "#FFD740" }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 750 }}>
                  Platz {placement} von {totalRankedTeams}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="glass" sx={{ mb: 4, background: "linear-gradient(135deg, rgba(124, 77, 255, 0.15) 0%, rgba(0, 229, 255, 0.05) 100%)" }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
            <EmojiEventsIcon sx={{ fontSize: 40, color: "#FFD740" }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 750 }}>
                Gesamtpunkte: {displayTotal}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {event?.status === "INACTIVE" && sortedScoreboardList.some((s) => getDoneTotal(s) > 0) && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Spielstand
          </Typography>
          <TableContainer component={Paper} sx={{ bgcolor: "transparent", backgroundImage: "none", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Team Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Punkte</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedScoreboardList.map((s) => {
                  const teamName = teamsMap.get(s.teamId) || s.teamId;
                  const pts = getDoneTotal(s);
                  return (
                    <TableRow key={s.teamId}>
                      <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                        {teamName}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "secondary.main" }}>
                        {pts}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}



      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Runden
      </Typography>

      <List sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        {rounds.map((round) => {
          const isInactive = round.status === "INACTIVE";
          const points = teamScore?.perRound?.[round.id] ?? null;

          return (
            <Card key={round.id} variant="outlined" sx={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <ListItem disablePadding>
                <ListItemButton
                  component={Link}
                  to={`/event/${eventId}/round/${round.id}`}
                  disabled={isInactive}
                  sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
                      Runde {round.number}: {round.title}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      {round.status === "ACTIVE" && (
                        <Typography variant="caption" sx={{ color: "#00E5FF", fontWeight: 650 }}>
                          Aktiv
                        </Typography>
                      )}
                      {round.status === "VALIDATION" && (
                        <Typography variant="caption" sx={{ color: "#FFD740", fontWeight: 650 }}>
                          Auswertung läuft
                        </Typography>
                      )}
                      {round.status === "DONE" && (
                        <Typography variant="caption" sx={{ color: "#69F0AE", fontWeight: 650 }}>
                          Beendet
                        </Typography>
                      )}
                      {isInactive && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          Noch nicht gestartet
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {round.status === "DONE" && points !== null && (
                      <Typography variant="body1" sx={{ fontWeight: 700, mr: 1 }}>
                        {points} Pkt.
                      </Typography>
                    )}
                    {round.status === "ACTIVE" && <PlayArrowIcon color="secondary" />}
                    {round.status === "DONE" && <CheckCircleIcon color="success" />}
                    {isInactive && <LockIcon color="disabled" />}
                  </Box>
                </ListItemButton>
              </ListItem>
            </Card>
          );
        })}
      </List>
    </Container>
  );
}
