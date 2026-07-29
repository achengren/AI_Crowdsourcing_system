ALTER TABLE case_annotations
  ADD COLUMN user_id CHAR(32) NULL AFTER submission_id,
  ADD COLUMN like_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER confidence,
  ADD COLUMN comment_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER like_count,
  ADD CONSTRAINT fk_annotations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_annotations_user (user_id);

UPDATE case_annotations a
JOIN submissions s ON s.id = a.submission_id
SET a.user_id = s.user_id
WHERE a.user_id IS NULL;

CREATE TABLE annotation_likes (
  annotation_id CHAR(32) NOT NULL,
  user_id CHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (annotation_id, user_id),
  CONSTRAINT fk_annotation_likes_annotation FOREIGN KEY (annotation_id) REFERENCES case_annotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_annotation_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_annotation_likes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE annotation_comments (
  id CHAR(32) PRIMARY KEY,
  annotation_id CHAR(32) NOT NULL,
  user_id CHAR(32) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_annotation_comments_annotation FOREIGN KEY (annotation_id) REFERENCES case_annotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_annotation_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_annotation_comments_time (annotation_id, created_at),
  INDEX idx_annotation_comments_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
