-- 6-month rolling projection function
-- Returns pipeline value (tentative_invoice_date, invoice_date IS NULL)
-- and actual revenue (invoice_date in current month, billing_value_final)
-- grouped by: consolidated / recruiter (linked_by) / spoc (mandates.am_id)
--
-- Visibility rule for recruiter/spoc mode:
--   Active non-founder profiles → always shown (even if all 6 months zero)
--   Founder profiles            → shown only if any non-zero month
--   Inactive profiles           → shown only if any non-zero month

CREATE OR REPLACE FUNCTION get_projection(p_group_by text DEFAULT 'consolidated')
RETURNS TABLE (
  group_id       uuid,
  group_name     text,
  month_index    int,
  month_start    date,
  pipeline_value numeric,
  pipeline_count bigint,
  actual_revenue numeric,
  actual_count   bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH
  -- 6 calendar months: current + next 5
  months AS (
    SELECT
      g AS idx,
      (date_trunc('month', current_date) + (g || ' months')::interval)::date AS mstart,
      (date_trunc('month', current_date) + ((g + 1) || ' months')::interval - interval '1 day')::date AS mend
    FROM generate_series(0, 5) AS g
  ),

  -- All relevant mc rows with group_id pre-computed
  mc_enriched AS (
    SELECT
      mc.billing_value_approx,
      mc.billing_value_final,
      mc.tentative_invoice_date,
      mc.invoice_date,
      CASE p_group_by
        WHEN 'recruiter' THEN mc.linked_by
        WHEN 'spoc'      THEN m.am_id
        ELSE             NULL::uuid
      END AS group_id
    FROM mandate_candidates mc
    LEFT JOIN mandates m ON m.id = mc.mandate_id
    WHERE
      -- Pipeline row: tentative_invoice_date within the 6-month window and not yet invoiced
      (
        mc.tentative_invoice_date IS NOT NULL
        AND mc.invoice_date IS NULL
        AND mc.tentative_invoice_date >= date_trunc('month', current_date)::date
        AND mc.tentative_invoice_date <  (date_trunc('month', current_date) + interval '6 months')::date
      )
      OR
      -- Actual revenue row: invoice_date within current calendar month
      (
        mc.invoice_date IS NOT NULL
        AND mc.invoice_date >= date_trunc('month', current_date)::date
        AND mc.invoice_date <  (date_trunc('month', current_date) + interval '1 month')::date
      )
  ),

  -- For recruiter/spoc: the set of people to show (visibility rule)
  --   Active non-founders → always included
  --   Founders + inactive → included only if they have data (via UNION below)
  all_groups AS (
    SELECT p.id AS group_id
    FROM profiles p
    WHERE p_group_by <> 'consolidated'
      AND p.active = true
      AND p.role <> 'founder'
    UNION
    SELECT DISTINCT group_id
    FROM mc_enriched
    WHERE group_id IS NOT NULL
  ),

  -- Cross product: one row per (group, month)
  group_months AS (
    SELECT
      ag.group_id,
      m.idx    AS month_index,
      m.mstart AS month_start,
      m.mend   AS month_end
    FROM months m
    CROSS JOIN (
      SELECT NULL::uuid AS group_id WHERE p_group_by = 'consolidated'
      UNION ALL
      SELECT group_id FROM all_groups WHERE p_group_by <> 'consolidated'
    ) ag
  )

  SELECT
    gm.group_id,
    p.name                                                             AS group_name,
    gm.month_index,
    gm.month_start,
    -- Pipeline: tentative_invoice_date in this month, invoice_date IS NULL
    COALESCE(SUM(CASE
      WHEN mc.invoice_date IS NULL
       AND mc.tentative_invoice_date >= gm.month_start
       AND mc.tentative_invoice_date <= gm.month_end
      THEN mc.billing_value_approx ELSE 0
    END), 0)                                                           AS pipeline_value,
    COUNT(CASE
      WHEN mc.invoice_date IS NULL
       AND mc.tentative_invoice_date >= gm.month_start
       AND mc.tentative_invoice_date <= gm.month_end
      THEN 1
    END)                                                               AS pipeline_count,
    -- Actual revenue: invoice_date in current month, billing_value_final (month 0 only)
    COALESCE(SUM(CASE
      WHEN gm.month_index = 0
       AND mc.invoice_date IS NOT NULL
       AND mc.invoice_date >= gm.month_start
       AND mc.invoice_date <= gm.month_end
      THEN mc.billing_value_final ELSE 0
    END), 0)                                                           AS actual_revenue,
    COUNT(CASE
      WHEN gm.month_index = 0
       AND mc.invoice_date IS NOT NULL
       AND mc.invoice_date >= gm.month_start
       AND mc.invoice_date <= gm.month_end
      THEN 1
    END)                                                               AS actual_count
  FROM group_months gm
  LEFT JOIN mc_enriched mc ON (
    gm.group_id IS NULL          -- consolidated: join all mc
    OR mc.group_id = gm.group_id -- grouped: join only matching group's mc
  )
  LEFT JOIN profiles p ON p.id = gm.group_id
  GROUP BY gm.group_id, p.name, gm.month_index, gm.month_start
  ORDER BY p.name NULLS FIRST, gm.month_index;
$$;

GRANT EXECUTE ON FUNCTION get_projection(text) TO authenticated;
