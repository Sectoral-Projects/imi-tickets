import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import "@/App.css";
import { ThemeProvider } from "./components/theme/provider.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Layout from "@/components/layout.tsx";
import App from "./App.tsx";
import Staff from "./Staff.tsx";
import Settings from "./Settings.tsx";
import Ticket from "./Ticket.tsx";
import Onboarding from "./Onboarding.tsx";
import Features from "./Features.tsx";
import About from "./About.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<Layout />}>
              <Route path="/" element={<App />} />
              <Route path="/features" element={<Features />} />
              <Route path="/about" element={<About />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/:ticketId" element={<Ticket />} />
            </Route>
          </Routes>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  </BrowserRouter>,
);
