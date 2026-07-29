ALTER TABLE users
  MODIFY must_change_password TINYINT(1) NOT NULL DEFAULT 0;

UPDATE users SET must_change_password = 0 WHERE must_change_password <> 0;
