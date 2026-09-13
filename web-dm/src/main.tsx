import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { WsProvider } from "@/services/ws";
import { i18n, loadLanguage } from "@/i18n";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "@beholden/shared/styles/tokens.css";
import "@beholden/shared/styles/base.css";

import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider i18n={i18n} loadLanguage={loadLanguage}>
      <ErrorBoundary>
        <WsProvider>
          <App />
        </WsProvider>
      </ErrorBoundary>
    </LanguageProvider>
  </React.StrictMode>
);
