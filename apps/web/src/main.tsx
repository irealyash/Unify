import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { HomePage } from "@/pages/HomePage";
import { HostPage } from "@/pages/HostPage";
import { PlayPage } from "@/pages/PlayPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/play/:code" element={<PlayPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </AuthProvider>
  </StrictMode>,
);
