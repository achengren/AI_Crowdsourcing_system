ALTER TABLE submissions
  ADD UNIQUE INDEX uq_submissions_revision_of (revision_of_id);
