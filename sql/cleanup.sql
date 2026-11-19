-- ============================================================================
-- Workforce Intelligence: cleanup
-- Drops everything sql/setup.sql created. Dropping the database removes its
-- schema, tables, dynamic table, views, policies, ML model, task, procedure,
-- git repository, stage, semantic view, and Cortex Agent.
-- ============================================================================
USE ROLE ACCOUNTADMIN;

ALTER TASK IF EXISTS WORKFORCE_INTEL_DB.HR.RETRAIN_ATTRITION_WEEKLY SUSPEND;
DROP DATABASE IF EXISTS WORKFORCE_INTEL_DB;
DROP WAREHOUSE IF EXISTS WORKFORCE_INTEL_WH;
DROP INTEGRATION IF EXISTS WI_GIT_API_INTEGRATION;
DROP ROLE IF EXISTS WI_HRBP_ROLE;
DROP ROLE IF EXISTS WI_COMP_ROLE;
DROP ROLE IF EXISTS WI_CHRO_ROLE;
DROP ROLE IF EXISTS WORKFORCE_DEMO_ROLE;

-- If you registered a key pair only for this example, also run:
-- ALTER USER <YOUR_USER> UNSET RSA_PUBLIC_KEY_2;
