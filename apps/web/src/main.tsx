import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { HomePage } from "@/pages/HomePage";
import { HostPage } from "@/pages/HostPage";
import { PlayPage } from "@/pages/PlayPage";
import { PreviewPage } from "@/pages/PreviewPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/play/:code" element={<PlayPage />} />
        {import.meta.env.DEV ? <Route path="/preview/:biome" element={<PreviewPage />} /> : null}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
    <Toaster position="bottom-right" theme="dark" richColors closeButton />
  </StrictMode>,
);
