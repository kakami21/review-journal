import { Navigate, Route, Routes } from "react-router";
import { PostListPage } from "./pages/PostListPage";
import HomePage from "./pages/HomePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/reviews" element={<PostListPage />} />
      <Route path="/posts" element={<PostListPage />} />
      <Route path="*" element={<Navigate to="/reviews" replace />} />
    </Routes>
  );
}
