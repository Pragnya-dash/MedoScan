import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Analyze from "@/pages/Analyze";
import PostDetail from "@/pages/PostDetail";
import Alerts from "@/pages/Alerts";
import AIInsights from "@/pages/AIInsights";
import Trends from "@/pages/Trends";
import Analytics from "@/pages/Analytics";
import Safety from "@/pages/Safety";
import Scan from "@/pages/Scan";

export default function App() {
  return (
    <div className="App min-h-screen bg-[#f9f8f6] text-[#1a1b25]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/insights" element={<AIInsights />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/scan" element={<Scan />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}
