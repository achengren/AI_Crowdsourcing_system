ALTER TABLE submissions
  ADD COLUMN error_types JSON NULL AFTER error_type,
  ADD COLUMN error_type_other VARCHAR(200) NOT NULL DEFAULT '' AFTER error_types,
  ADD COLUMN knowledge_scenario_other VARCHAR(200) NOT NULL DEFAULT '' AFTER knowledge_scenarios,
  ADD COLUMN source_issues JSON NULL AFTER source_issue,
  ADD COLUMN source_issue_other VARCHAR(200) NOT NULL DEFAULT '' AFTER source_issues;

UPDATE submissions
SET error_types = CASE
      WHEN error_type IS NULL OR error_type = '' THEN JSON_ARRAY('other')
      ELSE JSON_ARRAY(error_type)
    END,
    knowledge_scenarios = COALESCE(knowledge_scenarios, JSON_ARRAY()),
    source_issues = CASE
      WHEN source_issue IS NULL OR source_issue IN ('', 'none') THEN JSON_ARRAY()
      ELSE JSON_ARRAY(source_issue)
    END;
