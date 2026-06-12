-- Drop NOT NULL constraints on columns that are optional in the candidate form.
-- client_id is no longer required (clients link via mandates).
-- education, year_of_passing, relevant_exp, expected_ctc, emp_mode are all optional fields.
ALTER TABLE candidates
  ALTER COLUMN client_id      DROP NOT NULL,
  ALTER COLUMN education      DROP NOT NULL,
  ALTER COLUMN year_of_passing DROP NOT NULL,
  ALTER COLUMN relevant_exp   DROP NOT NULL,
  ALTER COLUMN expected_ctc   DROP NOT NULL,
  ALTER COLUMN emp_mode       DROP NOT NULL;
