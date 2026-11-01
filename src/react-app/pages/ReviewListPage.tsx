import { useState } from "react";
import type { ReviewsResponse } from "../../cms/review-page";

type SortType = "reviewDate" | "rating";

export type ReviewListProps =
  | { data: ReviewsResponse; errorMessage?: never }
  | { data?: never; errorMessage: string };

/** Astroで取得した公開版を初回HTMLと並び替えに使い、ブラウザで再取得しない。 */
export function ReviewListPage({ data, errorMessage }: ReviewListProps) {
  const [sortType, setSortType] = useState<SortType>("reviewDate");
  const reviews = data?.reviews;
  const lastUpdatedAt = data?.lastUpdatedAt;
  const sortedReviews = reviews ? [...reviews].sort((a, b) =>
    sortType === "reviewDate"
      ? b.reviewDate.localeCompare(a.reviewDate)
      : b.rating - a.rating,
  ) : [];

  return (
    <main className="brutal min-h-screen bg-amber-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-2">
          <div>
            <h1 className="text-4xl font-bold">箱入レオのルーザー日記</h1>
            {reviews && <p className="mt-2 opacity-70">{sortedReviews.length}件の口コミ</p>}
            {reviews && <p className="mt-1 text-sm opacity-60">
              最終取得：
              {lastUpdatedAt
                ? new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Tokyo",
                  }).format(new Date(lastUpdatedAt))
                : "未実行"}
            </p>}
          </div>

        </header>

        <div className="mb-4 flex items-center justify-end gap-4">
          <p className="text-sm font-bold">並び順</p>
          <div
            className="join grid w-56 grid-cols-2"
            aria-label="口コミの並び順"
          >
            <button
              className={`btn btn-sm join-item ${sortType === "reviewDate" ? "btn-primary" : "btn-ghost"}`}
              type="button"
              disabled={!reviews}
              aria-pressed={sortType === "reviewDate"}
              onClick={() => setSortType("reviewDate")}
            >
              訪問年月順
            </button>
            <button
              className={`btn btn-sm join-item ${sortType === "rating" ? "btn-primary" : "btn-ghost"}`}
              type="button"
              disabled={!reviews}
              aria-pressed={sortType === "rating"}
              onClick={() => setSortType("rating")}
            >
              評価順
            </button>
          </div>
        </div>

        {errorMessage && <p role="alert">{errorMessage}</p>}

        <ul className="space-y-4">
          {sortedReviews.map((review) => (
            <li key={review.id} id={review.id}>
              <article className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <a
                      className="link text-xl font-bold"
                      href={review.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {review.name}
                    </a>

                    <span className="badge badge-primary">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>

                  {review.title && (
                    <h2 className="font-bold">{review.title}</h2>
                  )}

                  {review.body && (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {review.body}
                    </p>
                  )}

                  <div className="flex justify-between gap-4 text-sm opacity-60">
                    <p>{review.reviewDate.replace("-", "/")} 訪問</p>
                    <p>いいね {review.likeCount}</p>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
