import React from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import QuizIcon from "@mui/icons-material/Quiz";
import { Link, useParams } from "react-router-dom";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { eventId } = useParams<{ eventId?: string }>();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static" color="transparent" elevation={0} className="glass" sx={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <Toolbar sx={{ gap: 2 }}>
          <QuizIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography
            variant="h6"
            component={Link}
            to="/admin"
            sx={{
              textDecoration: "none",
              color: "text.primary",
              fontWeight: 700,
              flexGrow: 1,
              background: "linear-gradient(135deg, #B388FF 0%, #00E5FF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SoAk Quiz Admin
          </Typography>

          {eventId && (
            <>
              <Button component={Link} to={`/admin/event/${eventId}`} color="inherit">
                Dashboard
              </Button>
              <Button component={Link} to={`/admin/event/${eventId}/validation`} color="inherit">
                Validierung
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
