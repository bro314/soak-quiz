import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useClaims } from "../hooks/useClaims";
import type { Event, Team } from "../types";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import GroupsIcon from "@mui/icons-material/Groups";

export function EventScreen() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { claims, loading: claimsLoading } = useClaims();
  const [event, setEvent] = useState<Event | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Redirect if already logged in as a team for this event
  useEffect(() => {
    if (!claimsLoading && claims.role === "team" && claims.eventId === eventId) {
      navigate(`/event/${eventId}/home`);
    }
  }, [claims, claimsLoading, eventId, navigate]);

  useEffect(() => {
    if (!eventId) return;

    // Listen to event doc
    const eventRef = doc(db, "events", eventId);
    const unsubEvent = onSnapshot(
      eventRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setEvent({ id: docSnap.id, ...docSnap.data() } as Event);
        } else {
          setError("Event nicht gefunden.");
        }
      },
      (err) => {
        console.error(err);
        setError("Fehler beim Laden des Events.");
      }
    );

    // Listen to teams collection
    const teamsRef = collection(db, "events", eventId, "teams");
    const unsubTeams = onSnapshot(
      teamsRef,
      (snapshot) => {
        const list: Team[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Team);
        });
        // Sort teams alphabetically
        list.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Fehler beim Laden der Teams.");
        setLoading(false);
      }
    );

    return () => {
      unsubEvent();
      unsubTeams();
    };
  }, [eventId]);

  if (loading || claimsLoading) {
    return (
      <Container sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress color="secondary" />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800 }}>
          {event?.name || "SoAk Quiz Event"}
        </Typography>
        {event?.status === "INACTIVE" && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Dieses Event ist momentan inaktiv.
          </Alert>
        )}
      </Box>

      <Card className="glass" sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <GroupsIcon color="secondary" />
              Teams
            </Typography>
            <Button
              component={Link}
              to={`/event/${eventId}/settings`}
              variant="contained"
              color="primary"
              startIcon={<GroupAddIcon />}
              size="small"
              disabled={event?.status === "INACTIVE"}
            >
              Team erstellen
            </Button>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {teams.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
              Noch keine Teams registriert. Erstelle das erste Team!
            </Typography>
          ) : (
            <List sx={{ width: "100%", bgcolor: "background.paper", borderRadius: 1 }}>
              {teams.map((team) => (
                <ListItem key={team.id} disablePadding divider>
                  <ListItemButton component={Link} to={`/event/${eventId}/login/${team.id}`}>
                    <ListItemText
                      primary={team.name}
                      secondary={team.memberNames || "Keine Mitglieder angegeben"}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
