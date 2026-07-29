ALTER TABLE submissions
  ADD COLUMN rejection_reason TEXT NOT NULL AFTER status,
  ADD COLUMN revision_of_id CHAR(32) NULL AFTER rejection_reason,
  ADD COLUMN revision_number INT UNSIGNED NOT NULL DEFAULT 1 AFTER revision_of_id,
  ADD CONSTRAINT fk_submissions_revision FOREIGN KEY (revision_of_id) REFERENCES submissions(id) ON DELETE SET NULL,
  ADD INDEX idx_submissions_revision (revision_of_id, revision_number);

ALTER TABLE case_annotations
  ADD COLUMN status ENUM('active', 'withdrawn') NOT NULL DEFAULT 'active' AFTER comment_count,
  ADD COLUMN withdrawn_at DATETIME(3) NULL AFTER status,
  ADD COLUMN withdrawn_by_user_id CHAR(32) NULL AFTER withdrawn_at,
  ADD CONSTRAINT fk_annotations_withdrawn_by FOREIGN KEY (withdrawn_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_annotations_submission_status (submission_id, status);

ALTER TABLE conversations
  ADD COLUMN context_summary LONGTEXT NULL AFTER title,
  ADD COLUMN summarized_message_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER context_summary;

CREATE TABLE ai_vision_cache (
  image_hash CHAR(64) NOT NULL,
  vision_model VARCHAR(100) NOT NULL,
  vision_context LONGTEXT NOT NULL,
  hit_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (image_hash, vision_model),
  INDEX idx_vision_cache_last_used (last_used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
