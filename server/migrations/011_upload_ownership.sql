CREATE TABLE IF NOT EXISTS uploaded_files (
  file_path VARCHAR(500) NOT NULL,
  user_id CHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (file_path),
  INDEX idx_uploaded_files_user (user_id),
  CONSTRAINT fk_uploaded_files_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
