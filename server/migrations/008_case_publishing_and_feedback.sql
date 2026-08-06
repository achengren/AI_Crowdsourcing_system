ALTER TABLE conversations
  ADD COLUMN title_manually_edited TINYINT(1) NOT NULL DEFAULT 0 AFTER title;

CREATE TABLE message_ratings (
  message_id CHAR(32) PRIMARY KEY,
  user_id CHAR(32) NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_message_ratings_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_ratings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_message_ratings_user_time (user_id, updated_at),
  INDEX idx_message_ratings_score_time (score, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE submissions
  MODIFY COLUMN status ENUM('draft', 'submitted', 'published', 'rejected', 'withdrawn') NOT NULL DEFAULT 'published',
  ADD COLUMN platform_other VARCHAR(100) NOT NULL DEFAULT '' AFTER platform,
  ADD COLUMN error_type VARCHAR(64) NOT NULL DEFAULT 'other' AFTER category,
  ADD COLUMN knowledge_scenarios JSON NULL AFTER error_type,
  ADD COLUMN source_issue VARCHAR(64) NOT NULL DEFAULT 'none' AFTER knowledge_scenarios,
  ADD COLUMN published_at DATETIME(3) NULL AFTER status,
  ADD COLUMN withdrawn_at DATETIME(3) NULL AFTER published_at,
  ADD COLUMN withdrawn_by_user_id CHAR(32) NULL AFTER withdrawn_at,
  ADD COLUMN withdrawn_reason TEXT NULL AFTER withdrawn_by_user_id,
  ADD CONSTRAINT fk_submissions_withdrawn_by FOREIGN KEY (withdrawn_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_submissions_status_published (status, published_at),
  ADD INDEX idx_submissions_error_type (error_type),
  ADD INDEX idx_submissions_source_issue (source_issue);

UPDATE submissions
SET error_type = CASE category
      WHEN 'factual_error' THEN 'factual_error'
      WHEN 'campus_info' THEN 'missing_information'
      WHEN 'image_understanding' THEN 'image_understanding_failure'
      WHEN 'interaction_unsatisfied' THEN 'irrelevant_answer'
      WHEN 'workflow' THEN 'capability_limitation'
      ELSE 'other'
    END,
    knowledge_scenarios = CASE category
      WHEN 'campus_info' THEN JSON_ARRAY('campus_information')
      WHEN 'news' THEN JSON_ARRAY('latest_news')
      WHEN 'domain_knowledge' THEN JSON_ARRAY('domain_knowledge')
      WHEN 'database_query' THEN JSON_ARRAY('database_query')
      WHEN 'login_required' THEN JSON_ARRAY('login_required')
      ELSE JSON_ARRAY()
    END,
    source_issue = CASE category
      WHEN 'unreliable_source' THEN 'unreliable_source'
      WHEN 'unverifiable' THEN 'unverifiable_source'
      WHEN 'no_source' THEN 'missing_source'
      ELSE 'none'
    END,
    published_at = CASE WHEN status = 'published' THEN created_at ELSE published_at END;

UPDATE case_annotations
SET issue_type = CASE issue_type
  WHEN '事实错误' THEN 'factual_error'
  WHEN '信息缺失' THEN 'missing_information'
  WHEN '逻辑问题' THEN 'reasoning_error'
  WHEN '答非所问' THEN 'irrelevant_answer'
  WHEN '表达误导' THEN 'misleading_expression'
  WHEN '过时信息' THEN 'factual_error'
  ELSE 'other'
END
WHERE issue_type NOT IN (
  'factual_error', 'missing_information', 'image_understanding_failure', 'irrelevant_answer',
  'reasoning_error', 'misleading_expression', 'capability_limitation', 'other'
);

INSERT INTO message_ratings (message_id, user_id, score, created_at, updated_at)
SELECT source_message_id, user_id, satisfaction, created_at, updated_at
FROM submissions
WHERE source_message_id IS NOT NULL AND satisfaction BETWEEN 1 AND 5
ON DUPLICATE KEY UPDATE score = VALUES(score), updated_at = VALUES(updated_at);

CREATE TABLE case_drafts (
  id CHAR(32) PRIMARY KEY,
  user_id CHAR(32) NOT NULL,
  source_message_id CHAR(32) NULL,
  source_diary_id CHAR(32) NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_case_drafts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_case_drafts_message FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT fk_case_drafts_diary FOREIGN KEY (source_diary_id) REFERENCES information_need_logs(id) ON DELETE SET NULL,
  INDEX idx_case_drafts_user_time (user_id, updated_at),
  INDEX idx_case_drafts_source_message (user_id, source_message_id),
  INDEX idx_case_drafts_source_diary (user_id, source_diary_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
