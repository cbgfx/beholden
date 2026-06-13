import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { WsProvider } from "@/services/ws";
import "@beholden/shared/styles/tokens.css";
import "@beholden/shared/styles/base.css";

import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WsProvider>
        <App />
      </WsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
