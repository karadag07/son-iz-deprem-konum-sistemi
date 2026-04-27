import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import AuditLogs from "./pages/AuditLogs";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import MapAnalysis from "./pages/MapAnalysis";
import PriorityAreas from "./pages/PriorityAreas";

function Protected() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="/map" element={<MapAnalysis />} />
        <Route path="/priority" element={<PriorityAreas />} />
        <Route path="/audit" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
