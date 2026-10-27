import { createRoot } from "react-dom/client";
import { PostListPage } from "../src/react-app/pages/PostListPage";
import "../src/react-app/styles.css";

createRoot(document.getElementById("root")!).render(<PostListPage />);
