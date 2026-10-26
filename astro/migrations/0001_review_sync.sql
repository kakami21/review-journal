-- CMS本文とは別に成功収集日時を保持し、追加0件の成功も記録する。
CREATE TABLE app_review_sync (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_updated_at TEXT NOT NULL
);
