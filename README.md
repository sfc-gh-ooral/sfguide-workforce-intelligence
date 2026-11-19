# Workforce Intelligence with Governed HR Data

Give HR business partners governed, plain-English answers on headcount, attrition risk, and pay
equity, with sensitive fields masked by role.

**[Landing page](https://sfc-gh-ooral.github.io/sfguide-workforce-intelligence/) · [Try the example in your browser](https://sfc-gh-ooral.github.io/sfguide-workforce-intelligence/try/)** (no account needed)

![Workforce overview as the HR business partner](docs/images/01-overview-hrbp.png)

HR analytics often depends on data engineering for every new report, attrition modeling runs
quarterly in spreadsheets, and compensation, performance, hiring, and survey data sit in separate
exports. This example brings them together in one app on Snowflake. Three personas see the same
screens through different policies:

| Persona | Snowflake role | What Snowflake enforces |
|---|---|---|
| HR business partner | `WI_HRBP_ROLE` | Row access: Operations only. Base, bonus, and band amounts rounded down to $10k; compa-ratio rounded down to one decimal. Gender and ethnicity masked. No access to model features, pay-equity cells, or team-member detail. |
| Compensation analyst | `WI_COMP_ROLE` | All business units, exact pay, and protected attributes for equity analysis. Team-member detail without risk scores. |
| CHRO | `WI_CHRO_ROLE` | Aggregation policy: every group must have at least 10 people, and smaller groups are merged into a remainder row. Pay gaps masked for small cells. |

The app has six screens:

1. **Workforce overview:** headcount, hires, exits, rolling 12-month attrition, and time to fill, by business unit.
2. **Attrition risk:** teams (not individuals) ranked by modeled risk, with top drivers. The drill-down shows the team's risk bands, the hiring backlog, an AI conversation plan, and, for the compensation analyst only, team members without risk scores. No persona can read an individual's risk score: an aggregation policy on the scores requires groups of 3 or more.
3. **Pay equity:** the regression-adjusted gap by job family and level, cohorts below band, and an AI **Explain** panel.
4. **Voice of employee:** survey themes and sentiment over four cycles, with an AI summary.
5. **Ask HR data:** a Cortex Agent for plain-English questions, running as the persona's role.
6. **Decisions log:** every flag, follow-up, escalation, and note recorded from the other screens.

> **Disclaimer.** Synthetic data and illustrative logic only. This isn't production-ready, and it
> isn't HR, legal, regulatory, or compliance advice. Attrition risk scores are illustrative and
> must not be used for decisions about individual employees.

## Prerequisites

| | No-account mode | Live mode |
|---|---|---|
| Snowflake | None | **Enterprise Edition** or higher (masking, row access, and aggregation policies) |
| Role | None | ACCOUNTADMIN to run `sql/setup.sql`. It creates a least-privilege role for everything else. |
| Features | None | Cortex AI functions (`AI_SENTIMENT`, `AI_CLASSIFY`, `AI_AGG`, `AI_COMPLETE`), Snowflake ML Classification, Cortex Analyst, and Cortex Agents in your region, or [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference) |
| Local | Node.js 20 or later | Node.js 20 or later, plus a key pair for your Snowflake user |

Tested in November 2026 with Node.js 22, Next.js 16, and `snowflake-sdk` 3.4, on an Enterprise
account in AWS US East 1, with `claude-sonnet-4-5` for `AI_COMPLETE`.

**Preview features.** This example labels **aggregation policies as Preview**. They were announced
as a preview feature, and the related tag-based aggregation policies page is still marked Preview,
so check the [aggregation policies documentation](https://docs.snowflake.com/en/user-guide/aggregation-policies)
for the current status in your account. The other features used were documented without a preview
label when checked in November 2026. `AI_CLASSIFY` lists document input as Preview; this example
classifies text only.

## Quick start: no-account mode

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-workforce-intelligence
cd sfguide-workforce-intelligence
npm install
npm run dev
```

Open http://localhost:3000. The app runs on bundled synthetic data (`data/sample/`), with no
credentials. AI buttons wait a few seconds, show the steps the live path runs, and return
scripted answers labeled **Sample AI response**. Use **View as** in the header to switch
personas.

> **View as isn't sign-in.** In Live mode, **View as** switches between the persona roles that one
> local Snowflake user holds (setup grants all three to you). It doesn't authenticate anyone. In a
> real deployment, each person signs in as themselves and holds only their own role.

## Live mode: deploy to your account

1. **Run the setup script.** Open a Snowsight SQL worksheet, choose ACCOUNTADMIN, and run
   [`sql/setup.sql`](sql/setup.sql) top to bottom. No edits are needed. It takes about 2–3 minutes on
   XSMALL (131 and 147 seconds in two test runs), most of it the Cortex AI functions over 10,727
   survey comments and model training.
   The script loads the synthetic CSVs from this public repository through a Git repository
   object, so no file upload is needed. It also grants the three persona roles to the user who
   runs it.
2. **Create a key pair** outside the repository and register the public key on your user:

   ```bash
   mkdir -p ~/.snowflake/keys
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out ~/.snowflake/keys/workforce_key.p8 -nocrypt
   openssl rsa -in ~/.snowflake/keys/workforce_key.p8 -pubout
   ```

   ```sql
   ALTER USER <YOUR_USER> SET RSA_PUBLIC_KEY_2 = '<public key body without the header lines>';
   ```

3. **Configure the app.** Copy `.env.example` to `.env.local` (git-ignored) and set
   `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USERNAME`, and `SNOWFLAKE_PRIVATE_KEY_PATH`. The other values
   already match what setup created.
4. **Start the app** with `npm run dev`. With a connection configured, the header switch defaults
   to **Live**. You can switch back to **Sample** at any time.

In Live mode the app opens one connection per persona role and turns off secondary roles. Every
screen query, AI call, agent question, and recorded decision runs as that role, so Snowflake
applies the policies. The app never takes credentials in the browser, and if a live call fails it
shows the error instead of falling back to sample data.

To remove everything, run [`sql/cleanup.sql`](sql/cleanup.sql) as ACCOUNTADMIN.

### Objects created

| Object | Name | Purpose |
|---|---|---|
| Roles | `WORKFORCE_DEMO_ROLE` | Owns every object below. Holds only the grants the example needs. |
| | `WI_HRBP_ROLE`, `WI_COMP_ROLE`, `WI_CHRO_ROLE` | Personas: explicit grants on the tables and views the app reads, plus insert on `ACTIONS`. `EMPLOYEE_FEATURES`, `V_TRAINING`, `V_SCORING`, and `BU_ACCESS` aren't granted to any persona. |
| API integration | `WI_GIT_API_INTEGRATION` | Read-only access to this public repository, with no credentials |
| Warehouse | `WORKFORCE_INTEL_WH` | XSMALL, `AUTO_SUSPEND = 60`, starts suspended |
| Database, schema | `WORKFORCE_INTEL_DB.HR` | Everything else lives here |
| Git repository, stage | `WI_REPO`, `WI_DATA` | Source of the synthetic CSVs |
| Tables | `EMPLOYEES`, `COMPENSATION`, `PERFORMANCE`, `PROMOTIONS`, `TERMINATIONS`, `REQUISITIONS`, `ENGAGEMENT_SURVEY`, `BU_ACCESS`, `ACTIONS` | Synthetic HR data, the persona-to-business-unit mapping, and recorded decisions |
| Derived tables | `SURVEY_AI`, `EMPLOYEE_RISK`, `FEATURE_IMPORTANCE`, `PAY_EQUITY_CELLS` | AI theme and sentiment, model scores with risk bands and 0/1 driver flags (no pay, rating, or tenure), feature importance, adjusted gaps |
| Dynamic table | `EMPLOYEE_FEATURES` | Attrition model features, `TARGET_LAG = '7 days'`. Owner-only, with row access and aggregation policies as defense in depth. |
| ML model | `ATTRITION_MODEL` | `SNOWFLAKE.ML.CLASSIFICATION` |
| Procedure, task | `RETRAIN_ATTRITION_MODEL`, `RETRAIN_ATTRITION_WEEKLY` | Weekly retrain and rescore. The task is created **suspended**. Run `ALTER TASK ... RESUME` to schedule it. |
| Views | `V_WORKFORCE`, `V_EXITS`, `V_OPEN_REQS`, `V_TEAMS`, `V_MONTHS`, `V_TEAM_MEMBERS`, `V_TRAINING`, `V_SCORING` | App and semantic view inputs. `V_TEAM_MEMBERS` is granted only to the compensation analyst; `V_TRAINING` and `V_SCORING` are owner-only model inputs. |
| Policies | `PAY_MASK`, `COMPA_MASK`, `PROTECTED_ATTR_MASK`, `SMALL_CELL_GAP_MASK` (masking), `BU_ROW_ACCESS` (row access), `MIN_GROUP_10`, `RISK_MIN_GROUP` (aggregation, Preview) | Governance by role. Every policy is an allowlist: roles it doesn't name, including ACCOUNTADMIN, get the most restricted result. |
| Semantic view | `WORKFORCE_SV` | Headcount, exits, and requisitions for Cortex Analyst |
| Cortex Agent | `WORKFORCE_AGENT` | Plain-English Q&A over `WORKFORCE_SV` |

The only account-level changes are the four roles, the integration, the warehouse, and the
database, and `GRANT EXECUTE TASK ON ACCOUNT` to `WORKFORCE_DEMO_ROLE`. The script changes nothing
that already exists.

### Expected cost and time

- **Setup:** about 2–3 minutes on XSMALL. In testing, a full setup plus an hour of clicking through
  every screen and persona in Live mode used about **0.56 warehouse credits**.
- **Cortex AI:** token-based and billed separately. Setup runs `AI_SENTIMENT` and `AI_CLASSIFY`
  once over 10,727 short comments. Each AI button or agent question in the app makes one call.
  See the [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf)
  for current rates.
- **Ongoing:** the warehouse auto-suspends after 60 seconds, the retraining task is suspended, and
  the dynamic table refreshes weekly. Run `sql/cleanup.sql` when you're done.

## How it works

- **Data layer split.** Screens read through `lib/workforce-data.ts`. Sample mode uses
  `lib/mock-source.ts` (the bundled JSON). Live mode calls `app/api/*`, which runs
  `lib/live-queries.ts` through `lib/snowflake.ts` with bind variables for every value.
- **Governed by Snowflake, not the app.** Masking, row access, and aggregation policies are
  attached to the base tables and key off `CURRENT_ROLE()`. Each policy names the roles allowed to
  see more; any other role gets the most restricted result.
  - **Pay can't be rebuilt from bands.** The HRBP sees base, bonus, and band min, mid, and max
    rounded down to $10k, and compa-ratio rounded down to one decimal. In a live test,
    compa-ratio × band midpoint was within $1k of true base for 33 of 2,238 HRBP-visible
    employees (median error $7,800).
  - **Model inputs aren't exposed.** `EMPLOYEE_FEATURES` refreshes as the owner role, so it holds
    every business unit's rows. No persona is granted it, or the views over it (`V_TRAINING`,
    `V_SCORING`). As the HRBP, CHRO, and compensation analyst, `SELECT` from them returns "does not
    exist or not authorized".
  - **No individual risk scores.** `RISK_MIN_GROUP` on `EMPLOYEE_RISK` requires groups of 3 or more
    for the HRBP and compensation analyst, and 10 for everyone else. Reading individual scores
    fails with "aggregation required". The app's risk queries use only `COUNT`, `SUM`, and `AVG`
    with `GROUP BY`, which is what an aggregation policy allows.
- **Adjusted pay gap.** Within each job family × level, log base pay and tenure are demeaned by
  rating group, log pay is regressed on tenure, and the gap is the difference in mean residuals
  for women and men. That controls for tenure and latest rating.
- **AI moments.** `AI_COMPLETE` explains a pay cell and drafts a team conversation plan from
  team-level inputs only. `AI_AGG` summarizes survey comments. For the CHRO, the aggregation policy
  blocks `AI_AGG` over raw comments, so the summary comes from aggregate counts through
  `AI_COMPLETE`.
- **Hosted example.** `npm run build:example` sets the API routes aside and runs a static export
  with `NEXT_PUBLIC_HOSTED_EXAMPLE=true` into `docs/try/`, which GitHub Pages serves. It's always
  in Sample mode.
- **Screenshots.** `npm run capture` serves `docs/try/` locally and captures `docs/images/` and the
  catalog cards with headless Chromium on synthetic data.

## Known limitations

- **Illustrative model.** The attrition label is "left voluntarily in the last 12 months", and
  features are taken as of 2026-10-31 for everyone. That leaks some information a production
  model would avoid with point-in-time features. Live scores come from ML Classification, and
  Sample scores from a fixed formula, so their rankings differ somewhat (see
  [`data/README.md`](data/README.md)).
- **Fairness and individual decisions.** The model's features exclude protected attributes
  (`V_TRAINING` has no gender or ethnicity), but proxies such as location, schedule, and job
  family can still carry bias. The model hasn't been validated for bias or disparate impact, and
  it must not drive decisions about individual employees. Scores are shown only as team averages
  and risk bands.
- **What the HRBP can still see.** Snowflake hides individual risk scores and team-member detail
  from the HRBP. By design, the HRBP can still query Operations employee records in `V_WORKFORCE`
  (names, job, location, and pay rounded to $10k, with gender and ethnicity masked). Names aren't
  masked, because team labels use manager names.
- **Aggregation policy trade-offs.** CHRO queries can't use window functions or `AI_AGG`. Monthly
  series with small counts can lose rows to the remainder group.
- **Agent answers vary.** Cortex Agent wording, and occasionally the generated SQL, can differ
  between runs. The agent sees only `WORKFORCE_SV`, which covers headcount, exits, and
  requisitions, not pay equity or survey text.
- **AI_AGG latency.** Summarizing about 2,800 comments for the compensation analyst took about 20
  seconds live.
- **Git loading needs a public repository.** If you fork this repository privately, replace the
  Git repository step with a `PUT` of `data/*.csv` to `@WI_DATA` (for example, with Snowflake CLI).

## Customize with Cortex Code

- "Map these tables to my HRIS export (for example, Workday report fields) without changing source
  objects, and list the PII columns that need masking."
- "Retrain the attrition model on my features, show feature importance, and register it in the
  Model Registry."
- "Set the minimum group size for aggregate views to 10 and test every persona."

## Repository layout

```text
app/              Next.js screens and API routes (live mode only)
components/       Shell, persona switch, AI panel, reasoning steps, decision dialog
lib/              Data layer (sample and live), personas, AI steps and sample answers
data/             Synthetic CSVs, per-persona sample bundles, and data/README.md
scripts/          generate-data.mjs, build-hosted-example.mjs, capture-screenshots.mjs
sql/              setup.sql and cleanup.sql
docs/             GitHub Pages landing page, screenshots, catalog cards, and try/ (hosted example)
```

## License and disclaimer

Licensed under the [Apache License 2.0](LICENSE). See also [LEGAL.md](LEGAL.md).

This is an illustrative example provided as-is. It isn't an official Snowflake product and isn't
supported by Snowflake Support. It contains no customer data. Review and test before any
production use.

Owner: Oz Oral · Last reviewed: November 2026
