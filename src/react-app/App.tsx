import { Navigate, Route, Routes } from "react-router";
import { ReviewListPage } from "./pages/ReviewListPage";
import HomePage from "./pages/HomePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/reviews" element={<ReviewListPage />} />
      <Route path="*" element={<Navigate to="/reviews" replace />} />
    </Routes>
  );
}
