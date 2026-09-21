
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { LanguageProvider } from "./app/i18n/LanguageContext";
  import { ThemeProvider } from "./app/i18n/ThemeContext";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  );
