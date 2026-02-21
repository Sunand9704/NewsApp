import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NewAnalysis from "./pages/NewAnalysis";
import DraftArticles from "./pages/DraftArticles";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/new-analysis" element={<NewAnalysis />} />
          <Route path="/new-analysis/:analysisId" element={<NewAnalysis />} />
          <Route path="/draft-articles" element={<DraftArticles />} />
          <Route path="/saved" element={<Navigate to="/draft-articles" replace />} />
          <Route path="/saved/:analysisId" element={<Navigate to="/draft-articles" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
