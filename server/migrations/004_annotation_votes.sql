ALTER TABLE case_annotations
  CHANGE COLUMN like_count agree_count INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN disagree_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER agree_count;

ALTER TABLE annotation_likes
  ADD COLUMN vote ENUM('agree', 'disagree') NOT NULL DEFAULT 'agree' AFTER user_id;
