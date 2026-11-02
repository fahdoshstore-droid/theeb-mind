# ADA2AI — Speaker Notes (English)

Deck: Dashboard & Capability Competitive Benchmark · 2 November 2026


## 1. Cover

Opening: this is an executive assessment of Ada2AI against five market benchmarks, dated 2 November 2026.
The purpose is not to make Ada2AI look stronger than it is. It is to show exactly where it stands, where it can win, what threatens its credibility, and which decisions come next.
The primary source is the report ADA2AI_Dashboard_Capability_Benchmark_2026-11-02, together with code inspection and a live database snapshot.
At the end we will ask for approval of five clear decisions.


## 2. Usable foundation — automated Football Intelligence not yet established

Main message: Ada2AI has a real product foundation to build on, but its status as a fully automated Football Intelligence platform has not been established.
Evidence: the code contains role-based dashboards (player, coach, scout, organizations), an evaluation form and video upload. But the live database snapshot of 2 November 2026 shows 0 rows in video_analyses, reports and matches; the evaluations table does not exist in the live database; and there is no independent execution evidence for the YOLO/FastAPI pipeline.
Why it matters: confusing 'exists in code' with 'operationally proven' is the biggest credibility risk with investors and academies.
Recommended decision: communicate externally only what is proven, and label everything else experimental until verified.


## 3. Executive summary — answers to the six questions

This slide summarises the whole deck in six answers. If there is time for only one slide, it is this one.
Key point: the five benchmarks are not one product category, and Veo in particular already offers video analysis and AI tracking to academies. Ada2AI cannot differentiate through video upload or AI terminology alone.
Proposed winning space: Arabic-first academy player development operations — connecting player profiles, coach evaluation, video evidence and longitudinal development.
Decision: approve security and identity as the priority before any growth, and run a one-academy pilot.


## 4. Five critical discoveries

The five discoveries are ordered by severity.
1) The evaluations table does not exist in the live database although the code queries it — evaluation history cannot work as designed.
2) Identity mismatch in video upload: the storage path uses players.id while the storage policy expects auth.uid().
3) The player-media bucket is public, with broad read and write policies. This is a potential exposure arising from configuration — not a confirmed breach. We must be precise about this wording.
4) Player comparison and PDF export are incomplete.
5) There is no independent execution evidence for the YOLO/FastAPI pipeline in production.
Note: severity levels are this deck's assessment, based on the impact described in the report.
Decision: items 2 and 3 must be closed before any commercial demo or growth.


## 5. Five benchmarks — five different product categories

Key idea: the five benchmarks are not identical products and should not be forced into one ranking.
Wyscout is professional scouting and recruitment, DataMB is statistical intelligence, Grintafy is talent discovery and participation, Grinta Rush is a field-based assessment format, and Veo is video-first academy analytics.
Why it matters: each benchmark teaches a different lesson, and comparison must be by category, not an overall ranking.
Implication for Ada2AI: we must pick a category where we can win, rather than trying to imitate everyone.


## 6. Hudl Wyscout — Professional Scouting & Recruitment

Wyscout is the reference for professional scouting. Its strength is linking search to event-tagged video, then to shortlists and reports, and finally to a recruitment decision.
Evidence: official public material as cited in the report; we did not test the product from the inside.
Lesson for Ada2AI: do not build disconnected screens; build one connected chain from evidence to decision. This is what we propose later: Evidence → Evaluation → Development → Decision.
We do not propose competing with Wyscout in global professional scouting.


## 7. DataMB — Statistical Football Intelligence

DataMB is a model of statistical intelligence: broad coverage, many metrics, and views such as Radar, Rank, Plot and Index.
Figures: 55 leagues, 120+ metrics and 5M+ data points — as reported in DataMB's official guide; not independently verified.
Lesson for Ada2AI: every number shown to a coach or scout must carry a definition, a source and context. This leads to the metric provenance principle on the coach dashboard.


## 8. Grintafy — Talent Discovery & Participation

Grintafy builds value on access to players and their recurring participation: profiles, skills videos, challenges and tryouts through which scouts discover talent.
Why it matters: the network and participation are competitive assets in themselves, not just analysis quality.
For Ada2AI: the academy is the natural access channel to players. Repeat use inside the academy matters more than a global player database — which is why we defer the global database and social network.


## 9. Grinta Rush — Field-Based Assessment Experience

Grinta Rush is a field-based assessment within an event: a competitive environment and changing match situations that test adaptability and decision-making, with academies taking part.
Important: this is an assessment/event format, not a verified standalone SaaS analytics platform. That is why we do not compare it with software on every dimension, and some of its cells in the matrix may be N/A.
Lesson for Ada2AI: Ada2AI could be the documentation and evaluation layer for events like this, not a substitute for them.


## 10. Veo — Video-First Academy Analytics

Veo is the closest to what some may imagine Ada2AI to be, so it deserves dedicated attention.
Veo already offers academies: match recording, clips, an events feed, AI tracking, physical metrics, heatmaps and shot maps, Analytics Studio, and multi-match trends.
Strategic conclusion: Ada2AI cannot differentiate merely through video upload, heatmaps or AI terminology — these are now table stakes.
Decision: our differentiation must come from linking human evaluation to evidence and development history, in Arabic, inside academy operations.


## 11. Positioning map — six separate dimensions, no overall ranking

This map is qualitative, not a score. Each product has one core category plus adjacent capabilities as shown in its public material.
Note that academy operations is not the core category of any of the five benchmarks, although Veo and Grinta Rush come close.
The Ada2AI row shows the proposed target position, not a proven current capability.
Decision: adopt Arabic-first academy player development operations as the positioning space.


## 12. Dashboard comparison — market reference vs. Ada2AI status

This matrix compares each dimension with the nearest market reference, then classifies Ada2AI's status by the type of evidence available.
Key limitation: no authenticated Ada2AI dashboard session was available during the audit, so status is based on code inspection and the database snapshot, not on viewing live screens. Competitor data comes from public material.
What stands out: search, profiles and the role structure exist; evaluation, video, reporting and development history are not operationally proven; mobile was not assessed.
Decision: close the red evaluation and video dimensions before adding any new feature.


## 13. Ada2AI product architecture — actual routes by role

These are the actual routes registered in App.tsx on the main branch.
Four areas: Player (dashboard, profile, upload, video analysis), Coach (dashboard, workspace, evaluation form), Scout (dashboard, search and a comparison entry point), and Administration (organizations, rankings, club dashboard).
Key note: the compare button exists on the scout dashboard, but the /compare route is not registered in App.tsx.
Why it matters: a route existing does not mean the function works; all routes depend on Supabase, and several of its tables are empty.


## 14. Player dashboard — what exists, and what is not proven

What exists in code: player information, evaluation retrieval, navigation to video upload, and the player profile experience.
Not proven: evaluation history on the live database — because the evaluations table does not exist; development over time; and any 'automated insights'.
Proposal: reorder the hierarchy to start with player identity, then latest evaluation, then evidence, then development history, then next action.
Caution: this is a proposed concept, not a current production screen. It must not be shown to a customer as an existing product.


## 15. Coach dashboard & workspace — coach-entered is not AI

The Coach Workspace is the strongest operational asset in the product: squad data, match statistics, pending analysis queue, interactive pitch, manual result entry, and completed analysis history.
Critical point: many metrics are entered manually by the coach. Showing them next to AI terminology without a source label misleads users and investors.
Proposal: label every metric with its source: coach-entered, AI-generated, imported, or unverified.
Decision: make metric provenance labelling mandatory before any commercial demo.


## 16. Scout dashboard — a solid base with two incomplete features

The scout dashboard includes: search, position filters, pagination, navigation to player profiles, sharing, and selecting two players for comparison.
Two incomplete features, confirmed in code: the /compare route is not registered in App.tsx despite the compare button; and the PDF button shows a 'PDF reports coming soon' message.
Verdict: KEEP search and filters; IMPROVE comparison and reporting — either complete them or hide them until they work.
A button that does not work must never be shown to an academy or an investor.


## 17. An Organizations Dashboard is not a multi-tenant academy system

Implemented: organization listing, organization count, player count, verification status, and average rating.
Not established: organization membership, tenant isolation, organization-level player ownership, and academy-specific permission management.
Note also that the organizations table has 0 rows in the live database.
Why it matters: a paying academy needs assurance that another academy cannot see its players' data. That is a condition of sale, not an add-on.
Decision: build organization membership and isolation before onboarding a second academy.


## 18. Live database reality — a table existing does not prove usage

This is the actual row count snapshot from Supabase on 2 November 2026.
6 of 11 tables are completely empty, including matches, video_analyses, reports and organizations. The evaluations table does not exist at all.
Why it matters: a table in the schema does not prove operational usage. There is no evidence yet of an academy using the product regularly.
Implication: any claim about 'analytics' or 'reports' must be read in light of these tables being empty.
Decision: measure progress by real, recurring records — not by the number of screens.


## 19. Data contract failure — upload success ≠ registered analysis

This is the expected chain from the user's identity to player evidence. A different identifier is used at each link.
Observed in code: the storage path starts with players.id; the storage policy expects auth.uid() in the first folder; uploaded_by references profiles.id; and a failure to create the analysis record is treated as non-fatal and only logged as a warning.
Result: the user may see 'upload successful' while no analysis is registered. This is consistent with 0 rows in video_analyses.
Decision: unify the identity contract and pass an end-to-end upload test as Gate 1 before the academy pilot.


## 20. AI reality check — three levels, none verified in production

We distinguish three levels: computer vision detection, then tracking and measurement, then tactical interpretation. Each is harder than the last and needs independent verification.
Reality: there is no independent execution evidence for the YOLO/FastAPI pipeline in production, and no ground truth to measure accuracy. The video_analyses table is empty.
Key distinctions: bounding boxes are not player performance; track IDs are not tactical intelligence; heatmaps are not automatically validated positioning; manually entered speed is not an AI-derived metric.
Decision: classify all computer vision capability as experimental until it passes a documented accuracy test on real academy data.


## 21. Security & privacy: top priority (P0)

This is the most important technical slide.
Findings are verified at configuration level: the player-media bucket is public with a public SELECT policy; video_analyses has a public read policy; broad authenticated write policies exist on football tables; reports have broad authenticated read access; API views need closer security validation; and organization-level isolation is not established.
Precise wording matters: these are configuration findings indicating potential exposure, not a confirmed breach. The report contains no evidence of actual unauthorised access.
Why it matters: this is youth athlete data and video. Academies and parents will not accept data that is public by default.
Decision: close the P0 items before any demo, pilot or growth. Note: severity and priority ratings are this deck's assessment.


## 22. Authentication & deployment drift — we need one source of truth

There is more than one possible deployment path: GitHub main, the authentication fix branch (fix/auth-profile-late-response) linked to PR #2 in the Ada2AI repository, EC2/Nginx deployment claims, multiple Vercel projects, a Supabase project reference, and an unverified FastAPI production endpoint.
We do not claim the site is down; the problem is that we cannot say with certainty which version of the code is running in production.
Why it matters: without one source of truth, a security fix may never reach production, and tests may run against the wrong version.
Decision: adopt one documented chain: domain → hosting → deployment SHA → Git branch → Supabase project → backend endpoint.


## 23. Capability matrix — 0–5 scores from the report

Presenter note: the source report file was not available when this version was prepared, so the score cells are intentionally empty. No score has been estimated. The scores must be copied from the report exactly, including N/A and U, before this deck is used.
How to read it: each row is a capability, each column a product. We do not sum scores into an overall ranking because the products belong to different categories.
Expected discussion: where Ada2AI genuinely leads (e.g. Arabic-first experience) and where it lags (video, tracking, integrations).
Decision: no score is adjusted to flatter Ada2AI.


## 24. Competitive gap analysis — from gap to action

Five gaps, ordered by their impact on our ability to sell to an academy.
Privacy and tenant isolation first, because it is a condition of sale and trust. Then evaluation persistence, the heart of the value proposition. Then the upload identity contract, which links evidence to the player. Then verification of the automated video pipeline. Finally comparison and reporting.
Each gap has a direct customer impact and a clear business risk.
Decision: adopt the five actions as the scope of work for the first 35 days.


## 25. Keep · Improve · Build · Defer

This is the summary of product decisions.
KEEP: what works and forms the basis of differentiation — role-based dashboards, player profiles, scout filtering, Coach Workspace, human evaluation, Arabic RTL.
IMPROVE: security, identity consistency, evaluation persistence, video upload, the comparison route, metric provenance, and dashboard information hierarchy.
BUILD after validation: evidence-backed evaluation, longitudinal player development, academy reports, and organization membership.
DEFER: all AI ambition before the foundation is proven — Player DNA, similarity engine, autonomous scouting copilot, global player database, full tactical AI, social network, marketplace, and unvalidated automated physical metrics.
Decision: explicitly approve the DEFER list — it is what protects focus.


## 26. Minimum viable product for the first paying academy

This is a practical product, not an aspirational platform. Seven steps represent the academy's weekly workflow: academy setup, team and player roster, match or training, coach evaluation, video evidence, development history, and player report.
Every step rests on secure organization permissions; without them we cannot sell.
Why it matters: this workflow turns existing pieces (player profile, evaluation form, upload) into connected value a customer will pay for.
Success metric: one academy using the full workflow repeatedly — not the number of features.
Note: this is a proposed workflow, not current production functionality.


## 27. 90-day roadmap — four phases, four gates

Four phases, each ending in a decision gate we pass only with evidence.
Days 1–15: Trust & Production Truth — close P0 security, unify identity, establish the deployment source of truth. Gate: security, identity and upload tests pass.
Days 16–35: Academy MVP consolidation. Gate: a coach can manage, evaluate and retrieve history.
Days 36–65: One-academy pilot. Gate: repeated use of the workflow.
Days 66–90: Paid conversion and intelligence validation. Gate: evidence of demand and willingness to pay.
Decision: no phase starts without passing the previous gate.


## 28. Five decisions required today

We ask for approval of five direct decisions:
1) Security before growth: no demos and no pilots before P0 is closed.
2) Fix identity and evaluation contracts: one consistent identifier and a real evaluations table.
3) Computer vision is experimental until proven against ground truth.
4) Pilot with one academy instead of expanding.
5) One approved production deployment path.
These decisions do not require a large budget, but they do require discipline in priorities.


## 29. Closing

Conclusion: the strategic north star is one chain: Evidence → Evaluation → Development → Decision.
We are not building a platform that claims intelligence, but one that proves how players improve and helps coaches make better decisions.
Three rules we commit to: evidence before expansion, product trust before AI ambition, and customer validation before scale.
We now open the discussion on the five decisions.


## 30. Source register

This is the source register behind the deck.
The primary source is the report. Code findings cited in the deck were verified directly in the public repository at commit 31a060b.
Competitor websites could not be reached while preparing this version, so their links are references and must be matched against the full source register in the report.
No Ada2AI or competitor screenshots are used in this deck.


## 31. Evidence limitations and how to read this deck

This slide protects the deck's credibility by stating what can and cannot be concluded.
No authenticated Ada2AI dashboard session was available during the audit, so no product screenshots are shown. Code existence does not prove production execution. Security findings are configuration findings, not a breach. No AI accuracy claims are made without ground truth.
Severity levels in this deck are assessments based on described impact and should be matched against the report's own ratings, if any.
