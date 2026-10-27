-- CMSの編集・削除・再公開から独立させ、同じ閲覧者の票だけを一意に保存する。
CREATE TABLE post_likes (
  post_key TEXT NOT NULL CHECK (length(post_key) > 0),
  visitor_id TEXT NOT NULL CHECK (length(visitor_id) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_key, visitor_id)
) WITHOUT ROWID;
