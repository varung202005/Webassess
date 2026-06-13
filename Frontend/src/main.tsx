import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import AuthBootstrap from "./components/AuthBootstrap";
import "./styles/base.css";
import "./features/faculty/faculty.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </QueryClientProvider>
  </React.StrictMode>
);
