# Synthetic data

Everything in this folder is synthetic. It comes from `scripts/generate-data.mjs`, a seeded
generator (mulberry32, seed `20261119`). Running `npm run generate` reproduces every file
byte-for-byte, so the numbers in Sample mode, Live mode, and the screenshots match.

No real people, employers, or HR records were used. Names are random combinations of first
names, middle initials, and surnames. Gender and ethnicity are assigned at random, so equity
analysis has something to work with. They don't describe anyone.

The data set's "today" is **2026-10-31**. Exits, hires, and trends cover November 2024 to
October 2026.

## Files

| File | Rows | Loaded into | Contents |
|---|---:|---|---|
| `employees.csv` | 15,500 | `HR.EMPLOYEES` | ID, name, business unit, job family, level, location, manager, hire and termination dates, status, work schedule, synthetic gender and ethnicity, remote flag. 11,983 are active. |
| `compensation.csv` | 15,500 | `HR.COMPENSATION` | Base, bonus target, band min/mid/max, compa-ratio |
| `performance.csv` | 46,552 | `HR.PERFORMANCE` | Ratings 1–5 for four cycles (2024H2–2026H1) |
| `promotions.csv` | 6,079 | `HR.PROMOTIONS` | Promotion date, from and to level |
| `terminations.csv` | 3,517 | `HR.TERMINATIONS` | Date, voluntary or involuntary, reason |
| `requisitions.csv` | 660 | `HR.REQUISITIONS` | Open and filled roles with hiring manager and dates |
| `engagement_survey.csv` | 32,031 | `HR.ENGAGEMENT_SURVEY` | Four survey cycles: engagement and manager scores, and 10,727 free-text comments |
| `sample/{hrbp,comp,chro}.json` | — | the app (Sample mode) | Precomputed screen data for each persona, with row filtering, masking, and small-group suppression applied the way the Snowflake policies apply them |
| `sample/meta.json` | — | — | Row counts and the measured values of each planted story |

Every table carries `business_unit`, so the row access policy can filter each table directly.

### Sample mode compared with Live mode

All counts, rates, pay figures, and gaps are identical in both modes. Three model outputs differ:

- **Themes and sentiment.** Sample mode uses the label of the phrase bank that generated each
  comment. Live mode classifies the same comments with `AI_CLASSIFY` and `AI_SENTIMENT`, so its
  counts differ a little. For example, 58% of Payment Operations comments are about schedules
  live, against 62% in the sample.
- **Flight-risk scores.** Sample mode uses a fixed logistic formula over the same features the
  live model sees. Live mode trains `SNOWFLAKE.ML.CLASSIFICATION`, which on this data relies
  mostly on tenure and time since promotion. Both rank Payment Operations highest among job
  families. The live model doesn't push story 3's team to the top the way the sample formula does.
- **AI text.** Sample answers are scripted from the same numbers. Live answers come from
  `AI_AGG`, `AI_COMPLETE`, and the Cortex Agent.

## Planted stories

These are deliberate patterns, so a walkthrough has something to find. The values below are
what this synthetic data set produces.

1. **Payment Operations attrition after a schedule change.** In May 2026, Payment Operations
   (Operations business unit) moves to rotating shifts. Its monthly voluntary exit rate roughly
   quadruples. There were 186 voluntary exits in the last six months, against 51 in the six
   months before (+265%). Most exit reasons after the change are "Schedule / work-life balance".
   In the 2026-09 survey, 62% of Payment Operations comments are about schedules and shifts,
   against about 1% for other job families.
2. **A persistent pay gap.** In Software Engineering, level L4 (Technology), women's base pay is
   set about 6.5% below comparable men's. After controlling for tenure and latest rating, the
   adjusted gap is still **−6.2%** (101 women, 93 men; raw gap −6.3%). Every other cell with at
   least 10 women and 10 men sits within about ±2%.
3. **A flight-risk team with a hiring backlog.** Client Service · Charlotte (Wealth Management,
   13 people) has pay held near 85% of band midpoint, low engagement, no recent promotions, and
   six open requisitions aged 74–146 days. In Sample mode it ranks first company-wide (65%
   average risk). The HRBP persona can't see it, because it's outside Operations.
4. **Wide spans of control.** Four managers have 17–19 direct reports: Infrastructure ·
   Charlotte, Branch Banking · Dallas, Contact Center · Phoenix, and Loan Operations ·
   Jacksonville. Their teams also score lower on engagement.
5. **Small groups for the CHRO view.** At job family × location × level, 320 groups have fewer
   than 10 people. The CHRO persona's aggregation policy merges them into one remainder group of
   1,515 people. Seventeen pay-equity cells have fewer than 10 women or 10 men, and their gaps
   are masked for the CHRO.

A below-band cohort is planted too: 40 of 110 Contact Center L1 employees (Retail Banking) sit
below band minimum.
