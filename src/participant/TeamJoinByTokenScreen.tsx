import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { joinTeamByTokenCallable } from "../firebase/functions";
import { useClaims } from "../hooks/useClaims";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

export function TeamJoinByTokenScreen() {
  const { eventId, teamId, token } = useParams<{ eventId: string; teamId: string; token: string }>();
  const navigate = useNavigate();
  const { refreshClaims } = useClaims();
  const [error, setError] = useState("");

  useEffect(() => {
    const eId = eventId;
    const tId = teamId;
    const tok = token;
    if (!eId || !tId || !tok) return;

    let active = true;

    async function performJoin() {
      try {
        const finalEId = eId as string;
        const finalTId = tId as string;
        const finalTok = tok as string;
        await joinTeamByTokenCallable({ eventId: finalEId, teamId: finalTId, token: finalTok });
        if (active) {
          // Save the token locally so the joined member also gets the QR invite feature
          localStorage.setItem(`soak_quiz_join_token_${finalEId}__${finalTId}`, finalTok);
          await refreshClaims();
          navigate(`/event/${finalEId}/home`);
        }
      } catch (err: any) {
        console.error(err);
        if (active) {
          setError(err.message || "Beitritt per Token fehlgeschlagen. Token ist möglicherweise ungültig.");
        }
      }
    }

    performJoin();

    return () => {
      active = false;
    };
  }, [eventId, teamId, token, refreshClaims, navigate]);

  return (
    <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {!error ? (
          <>
            <CircularProgress color="secondary" size={60} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Verbindung mit Team wird hergestellt…
            </Typography>
          </>
        ) : (
          <Alert severity="error" sx={{ width: "100%" }}>
            {error}
          </Alert>
        )}
      </Box>
    </Container>
  );
}
