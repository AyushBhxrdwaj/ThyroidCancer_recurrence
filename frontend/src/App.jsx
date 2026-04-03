import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import FollowUpPlanPage from "./pages/FollowUpPlanPage";
import PredictPage from "./pages/PredictPage";
import ReportPage from "./pages/ReportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/predict" element={<PredictPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/follow-up-plan" element={<FollowUpPlanPage />} />
    </Routes>
  );
}
