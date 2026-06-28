import { createTheme } from "@mui/material/styles";

// SoAk Quiz theme — dark mode with vibrant quiz-themed accents.
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7C4DFF", // Deep purple accent
      light: "#B388FF",
      dark: "#651FFF",
    },
    secondary: {
      main: "#00E5FF", // Cyan accent
      light: "#6EFFFF",
      dark: "#00B8D4",
    },
    background: {
      default: "#0A0E1A",
      paper: "#121829",
    },
    success: {
      main: "#69F0AE",
    },
    warning: {
      main: "#FFD740",
    },
    error: {
      main: "#FF5252",
    },
    text: {
      primary: "#E8EAED",
      secondary: "#9AA0A6",
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', sans-serif",
    h1: {
      fontWeight: 800,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontWeight: 700,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      letterSpacing: "0.02em",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(124, 77, 255, 0.12)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          "&:hover": {
            borderColor: "rgba(124, 77, 255, 0.3)",
            boxShadow: "0 8px 32px rgba(124, 77, 255, 0.15)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 10,
          padding: "10px 24px",
        },
        contained: {
          boxShadow: "0 4px 14px rgba(124, 77, 255, 0.35)",
          "&:hover": {
            boxShadow: "0 6px 20px rgba(124, 77, 255, 0.5)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;
