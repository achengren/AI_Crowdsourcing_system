ALTER TABLE annotation_comments
  ADD COLUMN parent_comment_id CHAR(32) NULL AFTER user_id,
  ADD COLUMN root_comment_id CHAR(32) NULL AFTER parent_comment_id,
  ADD COLUMN deleted_at DATETIME(3) NULL AFTER content,
  ADD COLUMN deleted_by_user_id CHAR(32) NULL AFTER deleted_at,
  ADD CONSTRAINT fk_annotation_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES annotation_comments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_annotation_comments_root FOREIGN KEY (root_comment_id) REFERENCES annotation_comments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_annotation_comments_deleted_by FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_annotation_comment_thread (annotation_id, root_comment_id, created_at),
  ADD INDEX idx_annotation_comment_parent (parent_comment_id);
