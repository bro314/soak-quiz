import React, { useState } from "react";
import { useClaims } from "../../hooks/useClaims";
import { loginAdminCallable } from "../../firebase/functions";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { useParams } from "react-router-dom";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { claims, loading, refreshClaims } = useClaims();
  const { eventId } = useParams<{ eventId?: string }>();
  
  const [password, setPassword] = useState("");
  const [localEventId, setLocalEventId] = useState(eventId || "");
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localEventId || !password) {
      setError("Event-ID und Passwort sind erforderlich.");
      return;
    }
    setLoginLoading(true);
    setError("");
    try {
      await loginAdminCallable({ eventId: localEventId, password });
      await refreshClaims();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falsches Passwort oder ungültige Event-ID.");
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Admin access matches when role is 'admin' and either there's no eventId constraint in URL,
  // or the URL eventId matches the token claim eventId.
  const hasAccess = claims.role === "admin" && (!eventId || claims.eventId === eventId);

  if (!hasAccess) {
    return (
      <Container maxWidth="xs" sx={{ py: 8 }}>
        <Card className="glass" sx={{ p: 2 }}>
          <CardContent>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
              <LockOpenIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
                Admin-Bereich
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
                Bitte gib die Event-ID und das Admin-Passwort ein.
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                label="Event-ID"
                fullWidth
                variant="outlined"
                value={localEventId}
                onChange={(e) => setLocalEventId(e.target.value)}
                disabled={!!eventId}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                label="Passwort"
                type="password"
                fullWidth
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 3 }}
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                disabled={loginLoading}
              >
                {loginLoading ? <CircularProgress size={24} /> : "Als Admin einloggen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return <>{children}</>;
}
