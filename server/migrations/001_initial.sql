CREATE TABLE users (
  id CHAR(32) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  class_name VARCHAR(100) NOT NULL DEFAULT '',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_users_role_status (role, status),
  INDEX idx_users_class (class_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversations (
  id CHAR(32) PRIMARY KEY,
  user_id CHAR(32) NOT NULL,
  title VARCHAR(100) NOT NULL DEFAULT '新对话',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversations_user_time (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE messages (
  id CHAR(32) PRIMARY KEY,
  conversation_id CHAR(32) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content LONGTEXT NOT NULL,
  quality_flag JSON NULL,
  provider VARCHAR(40) NOT NULL DEFAULT '',
  model VARCHAR(100) NOT NULL DEFAULT '',
  modality ENUM('text', 'vision') NOT NULL DEFAULT 'text',
  thinking_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_messages_conversation_time (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE information_need_logs (
  id CHAR(32) PRIMARY KEY,
  user_id CHAR(32) NOT NULL,
  log_date DATE NOT NULL,
  occurred_at TIME NULL,
  context_text TEXT NOT NULL,
  need_description TEXT NOT NULL,
  channels TEXT NOT NULL,
  search_process TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reflection TEXT NOT NULL,
  is_genai_related TINYINT(1) NOT NULL DEFAULT 0,
  genai_platform VARCHAR(40) NOT NULL DEFAULT '',
  linked_conversation_id CHAR(32) NULL,
  status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_diaries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_diaries_conversation FOREIGN KEY (linked_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  INDEX idx_diaries_user_date (user_id, log_date),
  INDEX idx_diaries_status_date (status, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE submissions (
  id CHAR(32) PRIMARY KEY,
  user_id CHAR(32) NOT NULL,
  prompt TEXT NOT NULL,
  platform VARCHAR(40) NOT NULL,
  model VARCHAR(100) NOT NULL DEFAULT '',
  ai_answer LONGTEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  share_link TEXT NOT NULL,
  satisfaction TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_good_case TINYINT(1) NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  tags JSON NOT NULL,
  images JSON NOT NULL,
  source_message_id CHAR(32) NULL,
  source_diary_id CHAR(32) NULL,
  status ENUM('draft', 'submitted', 'published', 'rejected') NOT NULL DEFAULT 'submitted',
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  comment_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_message FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT fk_submissions_diary FOREIGN KEY (source_diary_id) REFERENCES information_need_logs(id) ON DELETE SET NULL,
  INDEX idx_submissions_user_time (user_id, created_at),
  INDEX idx_submissions_status_category (status, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE case_annotations (
  id CHAR(32) PRIMARY KEY,
  submission_id CHAR(32) NOT NULL,
  selected_text TEXT NOT NULL,
  start_offset INT UNSIGNED NOT NULL,
  end_offset INT UNSIGNED NOT NULL,
  prefix_text VARCHAR(120) NOT NULL DEFAULT '',
  suffix_text VARCHAR(120) NOT NULL DEFAULT '',
  issue_type VARCHAR(64) NOT NULL,
  comment TEXT NOT NULL,
  source ENUM('user', 'ai') NOT NULL DEFAULT 'user',
  confidence DECIMAL(4,3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_annotations_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  INDEX idx_annotations_submission (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE likes (
  case_id CHAR(32) NOT NULL,
  user_id CHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (case_id, user_id),
  CONSTRAINT fk_likes_case FOREIGN KEY (case_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE comments (
  id CHAR(32) PRIMARY KEY,
  case_id CHAR(32) NOT NULL,
  user_id CHAR(32) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comments_case FOREIGN KEY (case_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comments_case_time (case_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id CHAR(32) PRIMARY KEY,
  actor_user_id CHAR(32) NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id VARCHAR(64) NOT NULL DEFAULT '',
  detail JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_time (created_at),
  INDEX idx_audit_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
