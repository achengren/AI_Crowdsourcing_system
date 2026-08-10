ALTER TABLE submissions
  ADD INDEX idx_submissions_source_diary (user_id, source_diary_id, status);
