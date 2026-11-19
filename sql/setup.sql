-- ============================================================================
-- Workforce Intelligence with Governed HR Data: Snowflake setup
-- Synthetic data and illustrative logic only. Not HR, legal, or compliance
-- advice. Risk scores are illustrative and must not be used for decisions
-- about individual employees.
-- ============================================================================
-- Run top to bottom in a Snowsight SQL worksheet as ACCOUNTADMIN. No edits or
-- find-and-replace needed. It takes about 10–15 minutes on XSMALL, mostly
-- model training and the AI functions over ~9,700 survey comments.
--
-- Requires:
--   * Enterprise Edition or higher (masking, row access, and aggregation policies)
--   * Cortex AI functions, Cortex Analyst, and Cortex Agents in your region, or
--     cross-region inference enabled (tested in AWS US East 1)
--
-- Creates (and sql/cleanup.sql drops):
--   roles        WORKFORCE_DEMO_ROLE   owns every object below (least privilege)
--                WI_HRBP_ROLE          HR business partner persona
--                WI_COMP_ROLE          compensation analyst persona
--                WI_CHRO_ROLE          CHRO persona (aggregates only)
--   integration  WI_GIT_API_INTEGRATION  read-only access to the public repo
--   warehouse    WORKFORCE_INTEL_WH    XSMALL, AUTO_SUSPEND = 60
--   database     WORKFORCE_INTEL_DB, schema HR: 9 tables, 1 dynamic table,
--                6 views, 4 policies, 1 ML classification model, 1 task
--                (suspended), 1 semantic view, 1 Cortex Agent, 1 git repository
-- It changes nothing that already exists.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0. ACCOUNTADMIN: roles, warehouse, database, and the few account-level grants
--    Everything after this section runs as WORKFORCE_DEMO_ROLE.
-- --------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;
SET my_user = CURRENT_USER();

CREATE ROLE IF NOT EXISTS WORKFORCE_DEMO_ROLE COMMENT = 'Workforce Intelligence example: owns the example objects';
CREATE ROLE IF NOT EXISTS WI_HRBP_ROLE COMMENT = 'Workforce Intelligence example: HR business partner (Operations), masked pay';
CREATE ROLE IF NOT EXISTS WI_COMP_ROLE COMMENT = 'Workforce Intelligence example: compensation analyst, full pay detail';
CREATE ROLE IF NOT EXISTS WI_CHRO_ROLE COMMENT = 'Workforce Intelligence example: CHRO, aggregates only (minimum group size 10)';
GRANT ROLE WORKFORCE_DEMO_ROLE TO ROLE SYSADMIN;
GRANT ROLE WI_HRBP_ROLE TO ROLE WORKFORCE_DEMO_ROLE;
GRANT ROLE WI_COMP_ROLE TO ROLE WORKFORCE_DEMO_ROLE;
GRANT ROLE WI_CHRO_ROLE TO ROLE WORKFORCE_DEMO_ROLE;
GRANT ROLE WORKFORCE_DEMO_ROLE TO USER IDENTIFIER($my_user);
GRANT ROLE WI_HRBP_ROLE TO USER IDENTIFIER($my_user);
GRANT ROLE WI_COMP_ROLE TO USER IDENTIFIER($my_user);
GRANT ROLE WI_CHRO_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS WORKFORCE_INTEL_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Workforce Intelligence example';
CREATE DATABASE IF NOT EXISTS WORKFORCE_INTEL_DB COMMENT = 'Workforce Intelligence example (synthetic data)';
GRANT OWNERSHIP ON DATABASE WORKFORCE_INTEL_DB TO ROLE WORKFORCE_DEMO_ROLE COPY CURRENT GRANTS;
GRANT USAGE, OPERATE ON WAREHOUSE WORKFORCE_INTEL_WH TO ROLE WORKFORCE_DEMO_ROLE;
GRANT USAGE ON WAREHOUSE WORKFORCE_INTEL_WH TO ROLE WI_HRBP_ROLE;
GRANT USAGE ON WAREHOUSE WORKFORCE_INTEL_WH TO ROLE WI_COMP_ROLE;
GRANT USAGE ON WAREHOUSE WORKFORCE_INTEL_WH TO ROLE WI_CHRO_ROLE;

-- Cortex AI functions, Cortex Analyst, and Cortex Agents
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE WORKFORCE_DEMO_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE WI_HRBP_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE WI_COMP_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE WI_CHRO_ROLE;
-- The weekly retraining task
GRANT EXECUTE TASK ON ACCOUNT TO ROLE WORKFORCE_DEMO_ROLE;

-- Read-only access to the public GitHub repository that holds the synthetic CSVs.
-- No credentials: the repository is public.
CREATE API INTEGRATION IF NOT EXISTS WI_GIT_API_INTEGRATION
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-ooral/sfguide-workforce-intelligence')
  ENABLED = TRUE
  COMMENT = 'Workforce Intelligence example: public repository with synthetic data';
GRANT USAGE ON INTEGRATION WI_GIT_API_INTEGRATION TO ROLE WORKFORCE_DEMO_ROLE;

-- --------------------------------------------------------------------------
-- 1. SCHEMA AND TABLES (as WORKFORCE_DEMO_ROLE from here on)
-- --------------------------------------------------------------------------
USE ROLE WORKFORCE_DEMO_ROLE;
USE WAREHOUSE WORKFORCE_INTEL_WH;
CREATE SCHEMA IF NOT EXISTS WORKFORCE_INTEL_DB.HR;
USE SCHEMA WORKFORCE_INTEL_DB.HR;

CREATE OR REPLACE TABLE EMPLOYEES (
  employee_id STRING, full_name STRING, business_unit STRING, job_family STRING, job_level STRING,
  location STRING, manager_id STRING, is_manager BOOLEAN, hire_date DATE, termination_date DATE,
  status STRING, work_schedule STRING, gender STRING, ethnicity STRING, remote_flag BOOLEAN);
CREATE OR REPLACE TABLE COMPENSATION (
  employee_id STRING, business_unit STRING, base_salary NUMBER(10,0), bonus_target NUMBER(10,0),
  band_min NUMBER(10,0), band_mid NUMBER(10,0), band_max NUMBER(10,0), compa_ratio NUMBER(6,3));
CREATE OR REPLACE TABLE PERFORMANCE (employee_id STRING, business_unit STRING, cycle STRING, rating NUMBER(1,0));
CREATE OR REPLACE TABLE PROMOTIONS (employee_id STRING, business_unit STRING, promotion_date DATE, from_level STRING, to_level STRING);
CREATE OR REPLACE TABLE TERMINATIONS (employee_id STRING, business_unit STRING, termination_date DATE, termination_type STRING, reason STRING);
CREATE OR REPLACE TABLE REQUISITIONS (
  req_id STRING, business_unit STRING, job_family STRING, location STRING, job_level STRING,
  hiring_manager_id STRING, opened_date DATE, filled_date DATE, status STRING);
CREATE OR REPLACE TABLE ENGAGEMENT_SURVEY (
  response_id STRING, employee_id STRING, business_unit STRING, job_family STRING, cycle STRING,
  survey_date DATE, engagement_score NUMBER(3,1), manager_score NUMBER(3,1), comment STRING);
-- Persona-to-business-unit mapping used by the row access policy
CREATE OR REPLACE TABLE BU_ACCESS (role_name STRING, business_unit STRING);
INSERT INTO BU_ACCESS VALUES ('WI_HRBP_ROLE', 'Operations');
-- Human-in-the-loop decisions recorded from the app (flag, assign, note)
CREATE OR REPLACE TABLE ACTIONS (
  action_id STRING DEFAULT UUID_STRING(), subject_type STRING, subject_id STRING, subject_label STRING,
  action STRING, note STRING, persona_role STRING DEFAULT CURRENT_ROLE(),
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP());

-- --------------------------------------------------------------------------
-- 2. LOAD THE SYNTHETIC DATA from the public repository
-- --------------------------------------------------------------------------
CREATE OR REPLACE GIT REPOSITORY WI_REPO
  API_INTEGRATION = WI_GIT_API_INTEGRATION
  ORIGIN = 'https://github.com/sfc-gh-ooral/sfguide-workforce-intelligence';
CREATE OR REPLACE STAGE WI_DATA COMMENT = 'Synthetic CSVs copied from the repository';
COPY FILES INTO @WI_DATA FROM @WI_REPO/branches/main/data/ PATTERN = '.*[.]csv';

CREATE OR REPLACE FILE FORMAT WI_CSV TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"' EMPTY_FIELD_AS_NULL = TRUE;
COPY INTO EMPLOYEES FROM @WI_DATA/employees.csv FILE_FORMAT = WI_CSV;
COPY INTO COMPENSATION FROM @WI_DATA/compensation.csv FILE_FORMAT = WI_CSV;
COPY INTO PERFORMANCE FROM @WI_DATA/performance.csv FILE_FORMAT = WI_CSV;
COPY INTO PROMOTIONS FROM @WI_DATA/promotions.csv FILE_FORMAT = WI_CSV;
COPY INTO TERMINATIONS FROM @WI_DATA/terminations.csv FILE_FORMAT = WI_CSV;
COPY INTO REQUISITIONS FROM @WI_DATA/requisitions.csv FILE_FORMAT = WI_CSV;
COPY INTO ENGAGEMENT_SURVEY FROM @WI_DATA/engagement_survey.csv FILE_FORMAT = WI_CSV;

-- --------------------------------------------------------------------------
-- 3. CORTEX AI ON SURVEY COMMENTS: sentiment (AI_SENTIMENT) and theme (AI_CLASSIFY)
-- --------------------------------------------------------------------------
CREATE OR REPLACE TABLE SURVEY_AI AS
SELECT response_id, employee_id, business_unit, job_family, cycle, survey_date, comment,
       AI_SENTIMENT(comment):categories[0]:sentiment::STRING AS sentiment,
       AI_CLASSIFY(comment, ['Schedules and shifts', 'Pay and benefits', 'Career growth', 'Manager support',
                             'Workload and staffing', 'Tools and systems', 'Flexibility and remote work', 'Recognition']
                  ):labels[0]::STRING AS theme
FROM ENGAGEMENT_SURVEY
WHERE comment IS NOT NULL;

-- --------------------------------------------------------------------------
-- 4. FEATURES (dynamic table) AND THE ATTRITION MODEL (ML Classification)
-- --------------------------------------------------------------------------
-- One row per employee, as of 2026-10-31. LEFT_VOLUNTARILY labels voluntary exits in the last 12 months.
CREATE OR REPLACE DYNAMIC TABLE EMPLOYEE_FEATURES
  TARGET_LAG = '7 days' WAREHOUSE = WORKFORCE_INTEL_WH
  COMMENT = 'Attrition model features, refreshed weekly'
AS
WITH last_rating AS (
  SELECT employee_id, rating FROM PERFORMANCE QUALIFY ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY cycle DESC) = 1),
last_eng AS (
  SELECT employee_id, engagement_score FROM ENGAGEMENT_SURVEY QUALIFY ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY survey_date DESC) = 1),
last_promo AS (SELECT employee_id, MAX(promotion_date) AS promo FROM PROMOTIONS GROUP BY employee_id),
span AS (SELECT manager_id, COUNT(*) AS span FROM EMPLOYEES WHERE status = 'Active' GROUP BY manager_id),
reqs AS (
  SELECT hiring_manager_id, COUNT(*) AS open_reqs_60 FROM REQUISITIONS
  WHERE status = 'Open' AND DATEDIFF('day', opened_date, DATE '2026-10-31') > 60 GROUP BY hiring_manager_id)
SELECT e.employee_id, e.business_unit, e.status,
       e.manager_id AS team_id,
       e.job_family, e.job_level, e.location, e.work_schedule, e.remote_flag,
       ROUND(DATEDIFF('day', e.hire_date, COALESCE(e.termination_date, DATE '2026-10-31')) / 365.0, 2) AS tenure_years,
       c.compa_ratio,
       COALESCE(r.rating, 3) AS last_rating,
       COALESCE(g.engagement_score, 3.7) AS last_engagement,
       DATEDIFF('month', COALESCE(p.promo, e.hire_date), DATE '2026-10-31') AS months_since_promo,
       COALESCE(s.span, 0) AS manager_span,
       COALESCE(q.open_reqs_60, 0) AS team_open_reqs_60,
       COALESCE(t.termination_type = 'Voluntary' AND t.termination_date > DATEADD('month', -12, DATE '2026-10-31'), FALSE) AS left_voluntarily
FROM EMPLOYEES e
JOIN COMPENSATION c ON c.employee_id = e.employee_id
LEFT JOIN last_rating r ON r.employee_id = e.employee_id
LEFT JOIN last_eng g ON g.employee_id = e.employee_id
LEFT JOIN last_promo p ON p.employee_id = e.employee_id
LEFT JOIN span s ON s.manager_id = e.manager_id
LEFT JOIN reqs q ON q.hiring_manager_id = e.manager_id
LEFT JOIN TERMINATIONS t ON t.employee_id = e.employee_id
WHERE e.status = 'Active' OR t.termination_date > DATEADD('month', -12, DATE '2026-10-31');

CREATE OR REPLACE VIEW V_TRAINING AS
SELECT job_family, job_level, location, work_schedule, remote_flag, tenure_years, compa_ratio, last_rating,
       last_engagement, months_since_promo, manager_span, team_open_reqs_60, left_voluntarily
FROM EMPLOYEE_FEATURES;

CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION ATTRITION_MODEL(
  INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_TRAINING'),
  TARGET_COLNAME => 'LEFT_VOLUNTARILY',
  CONFIG_OBJECT => {'evaluate': TRUE});

-- Scores for active employees: probability of voluntary exit
CREATE OR REPLACE TABLE EMPLOYEE_RISK AS
SELECT employee_id, business_unit, team_id, job_family, job_level, location,
       tenure_years, compa_ratio, last_rating, last_engagement, months_since_promo, manager_span, team_open_reqs_60, work_schedule,
       ROUND(ATTRITION_MODEL!PREDICT(INPUT_DATA => OBJECT_CONSTRUCT(*)):probability:"True"::FLOAT, 3) AS risk
FROM (SELECT employee_id, business_unit, team_id, job_family, job_level, location, work_schedule, remote_flag, tenure_years,
             compa_ratio, last_rating, last_engagement, months_since_promo, manager_span, team_open_reqs_60
      FROM EMPLOYEE_FEATURES WHERE status = 'Active');

CALL ATTRITION_MODEL!SHOW_FEATURE_IMPORTANCE();
CREATE OR REPLACE TABLE FEATURE_IMPORTANCE AS SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));

-- Weekly retrain and rescore. Created suspended; run ALTER TASK ... RESUME to schedule it.
CREATE OR REPLACE PROCEDURE RETRAIN_ATTRITION_MODEL()
RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER AS
$$
BEGIN
  CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION ATTRITION_MODEL(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'V_TRAINING'), TARGET_COLNAME => 'LEFT_VOLUNTARILY');
  CREATE OR REPLACE TABLE EMPLOYEE_RISK COPY GRANTS AS
  SELECT employee_id, business_unit, team_id, job_family, job_level, location,
         tenure_years, compa_ratio, last_rating, last_engagement, months_since_promo, manager_span, team_open_reqs_60, work_schedule,
         ROUND(ATTRITION_MODEL!PREDICT(INPUT_DATA => OBJECT_CONSTRUCT(*)):probability:"True"::FLOAT, 3) AS risk
  FROM (SELECT employee_id, business_unit, team_id, job_family, job_level, location, work_schedule, remote_flag, tenure_years,
               compa_ratio, last_rating, last_engagement, months_since_promo, manager_span, team_open_reqs_60
        FROM EMPLOYEE_FEATURES WHERE status = 'Active');
  RETURN 'Retrained and rescored';
END;
$$;
CREATE OR REPLACE TASK RETRAIN_ATTRITION_WEEKLY
  WAREHOUSE = WORKFORCE_INTEL_WH SCHEDULE = 'USING CRON 0 6 * * 1 UTC'
  COMMENT = 'Weekly attrition model retrain (suspended by default)'
AS CALL RETRAIN_ATTRITION_MODEL();

-- --------------------------------------------------------------------------
-- 5. PAY EQUITY: adjusted gap by job family x level
-- --------------------------------------------------------------------------
-- Within each cell, log(base) and tenure are demeaned by rating group, log(base) is regressed on
-- tenure, and the gap is mean residual (Female) minus mean residual (Male). This controls for
-- tenure and latest rating. Cells with fewer than 10 women or 10 men are flagged SMALL_CELL.
CREATE OR REPLACE TABLE PAY_EQUITY_CELLS AS
WITH base AS (
  SELECT e.job_family, e.job_level, e.business_unit, e.gender, c.base_salary,
         LN(c.base_salary) AS y, DATEDIFF('day', e.hire_date, DATE '2026-10-31') / 365.0 AS t, COALESCE(r.rating, 3) AS rating
  FROM EMPLOYEES e JOIN COMPENSATION c USING (employee_id)
  LEFT JOIN (SELECT employee_id, rating FROM PERFORMANCE QUALIFY ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY cycle DESC) = 1) r USING (employee_id)
  WHERE e.status = 'Active' AND e.gender IN ('Female', 'Male')),
dm AS (
  SELECT *, y - AVG(y) OVER (PARTITION BY job_family, job_level, rating) AS yd,
            t - AVG(t) OVER (PARTITION BY job_family, job_level, rating) AS td FROM base),
slope AS (
  SELECT *, COALESCE(SUM(td * yd) OVER (PARTITION BY job_family, job_level) / NULLIF(SUM(td * td) OVER (PARTITION BY job_family, job_level), 0), 0) AS b FROM dm)
SELECT job_family, job_level, ANY_VALUE(business_unit) AS business_unit,
       COUNT_IF(gender = 'Female') AS n_female, COUNT_IF(gender = 'Male') AS n_male,
       ROUND((AVG(IFF(gender = 'Female', base_salary, NULL)) / AVG(IFF(gender = 'Male', base_salary, NULL)) - 1) * 100, 1)::NUMBER(6,1) AS raw_gap_pct,
       ROUND((EXP(AVG(IFF(gender = 'Female', yd - b * td, NULL)) - AVG(IFF(gender = 'Male', yd - b * td, NULL))) - 1) * 100, 1)::NUMBER(6,1) AS adjusted_gap_pct,
       MEDIAN(base_salary)::NUMBER(10,0) AS median_base,
       LEAST(COUNT_IF(gender = 'Female'), COUNT_IF(gender = 'Male')) < 10 AS small_cell
FROM slope GROUP BY job_family, job_level
HAVING n_female > 0 AND n_male > 0;

-- --------------------------------------------------------------------------
-- 6. VIEWS the app and the agent read
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_WORKFORCE COMMENT = 'Employee-level workforce view with pay; governed by the policies in section 7' AS
SELECT e.employee_id, e.full_name, e.business_unit, e.job_family, e.job_level, e.location, e.manager_id,
       e.is_manager, e.hire_date, e.termination_date, e.status, e.work_schedule, e.gender, e.ethnicity, e.remote_flag,
       ROUND(DATEDIFF('day', e.hire_date, COALESCE(e.termination_date, DATE '2026-10-31')) / 365.0, 1) AS tenure_years,
       c.base_salary, c.bonus_target, c.band_min, c.band_mid, c.band_max, c.compa_ratio
FROM EMPLOYEES e JOIN COMPENSATION c USING (employee_id);

CREATE OR REPLACE VIEW V_EXITS COMMENT = 'Terminations with job details' AS
SELECT t.employee_id, t.business_unit, e.job_family, e.job_level, e.location, t.termination_date,
       DATE_TRUNC('month', t.termination_date) AS exit_month, t.termination_type, t.reason
FROM TERMINATIONS t JOIN EMPLOYEES e USING (employee_id);

CREATE OR REPLACE VIEW V_OPEN_REQS COMMENT = 'Requisitions with age in days as of 2026-10-31' AS
SELECT r.*, DATEDIFF('day', opened_date, COALESCE(filled_date, DATE '2026-10-31')) AS age_days,
       IFF(filled_date IS NULL, NULL, DATEDIFF('day', opened_date, filled_date)) AS days_to_fill
FROM REQUISITIONS r;

CREATE OR REPLACE VIEW V_TEAMS COMMENT = 'Manager teams' AS
SELECT m.employee_id AS team_id, m.full_name AS manager_name, m.business_unit, m.job_family, m.location,
       m.job_family || ' · ' || m.location || ' (' || SPLIT_PART(m.full_name, ' ', -1) || ')' AS team_name
FROM EMPLOYEES m WHERE m.is_manager AND m.status = 'Active';

CREATE OR REPLACE VIEW V_MONTHS AS
SELECT DATEADD('month', SEQ4(), DATE '2024-11-01') AS month_start,
       LAST_DAY(DATEADD('month', SEQ4(), DATE '2024-11-01')) AS month_end
FROM TABLE(GENERATOR(ROWCOUNT => 24));

-- --------------------------------------------------------------------------
-- 7. GOVERNANCE: masking, row access, and aggregation policies
-- --------------------------------------------------------------------------
-- Pay: the HRBP sees base and bonus rounded down to a $10k band; everyone else sees exact values.
CREATE OR REPLACE MASKING POLICY PAY_MASK AS (val NUMBER) RETURNS NUMBER ->
  CASE WHEN CURRENT_ROLE() = 'WI_HRBP_ROLE' THEN FLOOR(val / 10000) * 10000 ELSE val END;
-- Protected attributes: hidden from the HRBP
CREATE OR REPLACE MASKING POLICY PROTECTED_ATTR_MASK AS (val STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() = 'WI_HRBP_ROLE' THEN '***' ELSE val END;
-- Pay-equity gaps: hidden from the CHRO for small cells (fewer than 10 women or 10 men)
CREATE OR REPLACE MASKING POLICY SMALL_CELL_GAP_MASK AS (val NUMBER, small BOOLEAN) RETURNS NUMBER ->
  CASE WHEN CURRENT_ROLE() = 'WI_CHRO_ROLE' AND small THEN NULL ELSE val END;
-- Business unit row access: the HRBP sees only the BUs mapped in BU_ACCESS
CREATE OR REPLACE ROW ACCESS POLICY BU_ROW_ACCESS AS (bu STRING) RETURNS BOOLEAN ->
  CURRENT_ROLE() IN ('WORKFORCE_DEMO_ROLE', 'WI_COMP_ROLE', 'WI_CHRO_ROLE')
  OR EXISTS (SELECT 1 FROM BU_ACCESS a WHERE a.role_name = CURRENT_ROLE() AND a.business_unit = bu);
-- Minimum group size: the CHRO must aggregate, and groups under 10 people go to a remainder group
CREATE OR REPLACE AGGREGATION POLICY MIN_GROUP_10 AS () RETURNS AGGREGATION_CONSTRAINT ->
  CASE WHEN CURRENT_ROLE() = 'WI_CHRO_ROLE' THEN AGGREGATION_CONSTRAINT(MIN_GROUP_SIZE => 10)
       ELSE NO_AGGREGATION_CONSTRAINT() END;

ALTER TABLE COMPENSATION MODIFY COLUMN base_salary SET MASKING POLICY PAY_MASK;
ALTER TABLE COMPENSATION MODIFY COLUMN bonus_target SET MASKING POLICY PAY_MASK;
ALTER TABLE EMPLOYEES MODIFY COLUMN gender SET MASKING POLICY PROTECTED_ATTR_MASK;
ALTER TABLE EMPLOYEES MODIFY COLUMN ethnicity SET MASKING POLICY PROTECTED_ATTR_MASK;
ALTER TABLE PAY_EQUITY_CELLS MODIFY COLUMN raw_gap_pct SET MASKING POLICY SMALL_CELL_GAP_MASK USING (raw_gap_pct, small_cell);
ALTER TABLE PAY_EQUITY_CELLS MODIFY COLUMN adjusted_gap_pct SET MASKING POLICY SMALL_CELL_GAP_MASK USING (adjusted_gap_pct, small_cell);
ALTER TABLE PAY_EQUITY_CELLS MODIFY COLUMN median_base SET MASKING POLICY SMALL_CELL_GAP_MASK USING (median_base, small_cell);

ALTER TABLE EMPLOYEES ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE COMPENSATION ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE PERFORMANCE ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE PROMOTIONS ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE TERMINATIONS ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE REQUISITIONS ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE ENGAGEMENT_SURVEY ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE SURVEY_AI ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE EMPLOYEE_RISK ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);
ALTER TABLE PAY_EQUITY_CELLS ADD ROW ACCESS POLICY BU_ROW_ACCESS ON (business_unit);

ALTER TABLE EMPLOYEES SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE COMPENSATION SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE PERFORMANCE SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE PROMOTIONS SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE TERMINATIONS SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE ENGAGEMENT_SURVEY SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE SURVEY_AI SET AGGREGATION POLICY MIN_GROUP_10;
ALTER TABLE EMPLOYEE_RISK SET AGGREGATION POLICY MIN_GROUP_10;

-- --------------------------------------------------------------------------
-- 8. SEMANTIC VIEW AND CORTEX AGENT for "Ask HR data"
-- --------------------------------------------------------------------------
-- The agent runs with the caller's role, so every policy above still applies to its queries.
CREATE OR REPLACE SEMANTIC VIEW WORKFORCE_SV
  TABLES (
    WORKFORCE AS V_WORKFORCE PRIMARY KEY (EMPLOYEE_ID)
      COMMENT = 'One row per employee (active and terminated) with job, location, and pay',
    EXITS AS V_EXITS PRIMARY KEY (EMPLOYEE_ID)
      COMMENT = 'Voluntary and involuntary terminations with reason',
    REQS AS V_OPEN_REQS PRIMARY KEY (REQ_ID)
      COMMENT = 'Requisitions (open and filled) with age in days'
  )
  DIMENSIONS (
    WORKFORCE.BU AS BUSINESS_UNIT COMMENT = 'Business unit'
      SAMPLE_VALUES ('Operations', 'Technology', 'Retail Banking', 'Commercial Banking', 'Wealth Management', 'Risk & Finance'),
    WORKFORCE.FAMILY AS JOB_FAMILY COMMENT = 'Job family, for example Payment Operations or Software Engineering',
    WORKFORCE.LEVEL AS JOB_LEVEL COMMENT = 'Job level L1 (entry) to L7 (executive)',
    WORKFORCE.CITY AS LOCATION COMMENT = 'Work location city',
    WORKFORCE.EMP_STATUS AS STATUS COMMENT = 'Active or Terminated' SAMPLE_VALUES ('Active', 'Terminated'),
    WORKFORCE.SCHEDULE AS WORK_SCHEDULE COMMENT = 'Rotating shifts, Fixed shifts, or Standard hours',
    WORKFORCE.HIRE_DT AS HIRE_DATE COMMENT = 'Hire date',
    EXITS.EXIT_BU AS BUSINESS_UNIT COMMENT = 'Business unit of the person who left',
    EXITS.EXIT_FAMILY AS JOB_FAMILY COMMENT = 'Job family of the person who left',
    EXITS.EXIT_TYPE AS TERMINATION_TYPE COMMENT = 'Voluntary or Involuntary' SAMPLE_VALUES ('Voluntary', 'Involuntary'),
    EXITS.EXIT_REASON AS REASON COMMENT = 'Termination reason',
    EXITS.EXIT_MONTH_DIM AS EXIT_MONTH COMMENT = 'Month of termination',
    REQS.REQ_BU AS BUSINESS_UNIT COMMENT = 'Business unit of the requisition',
    REQS.REQ_FAMILY AS JOB_FAMILY COMMENT = 'Job family of the requisition',
    REQS.REQ_LOCATION AS LOCATION COMMENT = 'Location of the requisition',
    REQS.REQ_STATUS AS STATUS COMMENT = 'Open or Filled' SAMPLE_VALUES ('Open', 'Filled'),
    REQS.REQ_AGE AS AGE_DAYS COMMENT = 'Days since the requisition opened (to fill date if filled)'
  )
  METRICS (
    WORKFORCE.HEADCOUNT AS COUNT_IF(STATUS = 'Active') COMMENT = 'Active headcount',
    WORKFORCE.AVG_BASE AS AVG(BASE_SALARY) COMMENT = 'Average base salary in USD (masked to $10k bands for HR business partners)',
    WORKFORCE.AVG_COMPA AS AVG(COMPA_RATIO) COMMENT = 'Average compa-ratio (base / band midpoint)',
    EXITS.EXIT_COUNT AS COUNT(EMPLOYEE_ID) COMMENT = 'Number of terminations',
    REQS.REQ_COUNT AS COUNT(REQ_ID) COMMENT = 'Number of requisitions',
    REQS.AVG_DAYS_TO_FILL AS AVG(DAYS_TO_FILL) COMMENT = 'Average days to fill for filled requisitions'
  )
  COMMENT = 'Synthetic workforce data. The as-of date is 2026-10-31.';

CREATE OR REPLACE AGENT WORKFORCE_AGENT
  COMMENT = 'HR data assistant for HR business partners (synthetic data)'
  FROM SPECIFICATION $$
  models:
    orchestration: auto
  orchestration:
    budget:
      seconds: 60
      tokens: 16000
  instructions:
    response: |
      You answer HR business partners' questions about headcount, exits, and open requisitions.
      Always query the data before answering. Be concise: lead with the number, then one or two
      sentences of context. Today is 2026-10-31 in this data set. Pay values may be masked to
      $10k bands and some business units may be hidden by policy for the current role; say so
      when it affects the answer. Never speculate about individual employees.
    orchestration: Use the Analyst tool for every data question.
    sample_questions:
      - question: How many open reqs in Operations are older than 60 days?
      - question: What are the top reasons for voluntary exits in Payment Operations since May 2026?
  tools:
    - tool_spec:
        type: cortex_analyst_text_to_sql
        name: Analyst
        description: Workforce headcount, exits, and requisitions
  tool_resources:
    Analyst:
      semantic_view: WORKFORCE_INTEL_DB.HR.WORKFORCE_SV
      execution_environment:
        type: warehouse
        warehouse: WORKFORCE_INTEL_WH
  $$;

-- --------------------------------------------------------------------------
-- 9. PERSONA GRANTS (read-only, plus recording actions)
-- --------------------------------------------------------------------------
GRANT USAGE ON DATABASE WORKFORCE_INTEL_DB TO ROLE WI_HRBP_ROLE;
GRANT USAGE ON DATABASE WORKFORCE_INTEL_DB TO ROLE WI_COMP_ROLE;
GRANT USAGE ON DATABASE WORKFORCE_INTEL_DB TO ROLE WI_CHRO_ROLE;
GRANT USAGE ON SCHEMA HR TO ROLE WI_HRBP_ROLE;
GRANT USAGE ON SCHEMA HR TO ROLE WI_COMP_ROLE;
GRANT USAGE ON SCHEMA HR TO ROLE WI_CHRO_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA HR TO ROLE WI_HRBP_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA HR TO ROLE WI_COMP_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA HR TO ROLE WI_CHRO_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA HR TO ROLE WI_HRBP_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA HR TO ROLE WI_COMP_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA HR TO ROLE WI_CHRO_ROLE;
GRANT INSERT ON TABLE ACTIONS TO ROLE WI_HRBP_ROLE;
GRANT INSERT ON TABLE ACTIONS TO ROLE WI_COMP_ROLE;
GRANT INSERT ON TABLE ACTIONS TO ROLE WI_CHRO_ROLE;
GRANT SELECT ON SEMANTIC VIEW WORKFORCE_SV TO ROLE WI_HRBP_ROLE;
GRANT SELECT ON SEMANTIC VIEW WORKFORCE_SV TO ROLE WI_COMP_ROLE;
GRANT SELECT ON SEMANTIC VIEW WORKFORCE_SV TO ROLE WI_CHRO_ROLE;
GRANT USAGE ON AGENT WORKFORCE_AGENT TO ROLE WI_HRBP_ROLE;
GRANT USAGE ON AGENT WORKFORCE_AGENT TO ROLE WI_COMP_ROLE;
GRANT USAGE ON AGENT WORKFORCE_AGENT TO ROLE WI_CHRO_ROLE;

-- --------------------------------------------------------------------------
-- 10. QUICK CHECKS: the same query, three roles, three governed answers
-- --------------------------------------------------------------------------
USE ROLE WI_HRBP_ROLE;
SELECT business_unit, COUNT(*) AS active, AVG(base_salary) AS avg_base_masked FROM V_WORKFORCE WHERE status = 'Active' GROUP BY 1;
USE ROLE WI_CHRO_ROLE;
SELECT job_family, location, job_level, COUNT(*) AS active FROM V_WORKFORCE WHERE status = 'Active' GROUP BY 1, 2, 3 ORDER BY 4;
USE ROLE WORKFORCE_DEMO_ROLE;
SELECT job_family, job_level, n_female, n_male, adjusted_gap_pct FROM PAY_EQUITY_CELLS ORDER BY adjusted_gap_pct LIMIT 5;
