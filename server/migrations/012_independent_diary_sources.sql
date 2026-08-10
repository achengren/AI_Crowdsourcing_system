ALTER TABLE information_need_logs
  ADD COLUMN source_message_id CHAR(32) NULL AFTER linked_conversation_id,
  ADD COLUMN source_submission_id CHAR(32) NULL AFTER source_message_id,
  ADD CONSTRAINT fk_diaries_source_message FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_diaries_source_submission FOREIGN KEY (source_submission_id) REFERENCES submissions(id) ON DELETE SET NULL,
  ADD INDEX idx_diaries_source_message (user_id, source_message_id),
  ADD INDEX idx_diaries_source_submission (user_id, source_submission_id);
