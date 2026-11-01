import { createRoot } from "react-dom/client";
import { PostListPage } from "../src/react-app/pages/PostListPage";
import "../src/react-app/styles.css";

// 写真・いいね以外の外部依存を持たない、ローカル確認専用の公開投稿。
createRoot(document.getElementById("root")!).render(<PostListPage initialData={{ lastUpdatedAt: null, posts: [
  { id: "food", contentId: "cms-food", collection: "reviews", kind: "review", source: "tabelog", name: "確認用の店舗", url: "https://example.com/shop", title: "食べログ由来の口コミ", body: "食べログの取得値を保ち、このアプリのいいねは別に保存します。", publishedAt: null, reviewDate: "2026-10", rating: 4, likeCount: 99, appLikeCount: 0 },
  { id: "manual-note", contentId: "cms-note", collection: "entries", kind: "note", source: "manual", name: null, url: null, title: "手入力ノート", body: "店舗や評価のない投稿にもいいねできます。", publishedAt: "2026-11-01T00:00:00Z", reviewDate: null, rating: null, likeCount: null, appLikeCount: 0 },
] }} />);
