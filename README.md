AI-Mediated Complexity Translation in Scientific Literature
A Quasi-Experimental Study of the Paper-to-Human Tool with Mexican High School Students
Complete Research Methodology
Independent Research Project
Colegio Azcapotzalco — Mexico City, Mexico
Field category: Behavioral & Social Sciences / Computer Science (AI Ethics in Education)
 
Table of Contents


 
Study Overview
Paper-to-Human is a zero-cost, AI-powered tool that uses the Claude API (Anthropic) to transform a single academic paper into three simultaneous versions adapted to different comprehension levels: a 12-year-old with no scientific background (Version 1), an adult without university education (Version 2), and a professional in the relevant field (Version 3). Each version delivers a one-paragraph summary, three key concepts explained simply, and one real-world analogy. All AI-generated outputs are manually fact-checked against the source paper before use, converting the claim of "zero cost" into the more defensible claim of "low cost with researcher oversight."
Research question. Does AI-mediated complexity translation (Paper-to-Human) significantly increase both scientific comprehension and positive attitude toward scientific literature among Mexican high school students, compared to direct exposure to the original academic paper?
Source paper for the intervention. Buolamwini & Gebru, “Gender Shades” (2018). It is open access, conceptually intuitive (AI systems make more errors for certain demographic groups), and directly relevant to adolescents who use recommendation and classification algorithms daily. The domain is deliberately AI ethics / computer science rather than health sciences: the content is academically technical yet conceptually accessible to adolescents. IMPORTANT PRE-STUDY VERIFICATION: Before finalizing this paper, the researcher must generate Paper-to-Human Version 2 for Gender Shades and confirm that the simplified output is genuinely comprehensible to a 15-year-old without technical background. If statistical concepts (intersectionality, benchmark error rates, dataset composition) remain opaque even in simplified form, the recommended alternative is a paper on algorithmic bias in social media recommendation systems, which is conceptually equivalent but more immediately familiar to adolescents who use TikTok and Instagram daily.
Citation convention. Every methodological decision below is justified against the 16 verified sources listed in the Bibliography. In-text references use the form “(Source N)” and map directly to the numbered Bibliography in Section J.
Section A — Hypotheses
Three directional, testable hypotheses are stated with their corresponding null hypotheses. Directionality is justified by prior empirical evidence that AI simplification improves comprehension (Sources 8, 10) and by cognitive load theory, which predicts that reducing extraneous and intrinsic load improves understanding (Source 4).
Primary hypothesis — Comprehension (H1)
H1: Mexican high school students who read the Paper-to-Human translated version (experimental group) will achieve significantly higher post-test comprehension scores than students who read the original academic paper (control group). Justification: AI-simplified texts produced significant comprehension gains in comparable one-shot interventions (Source 8) and matched or surpassed human-created adaptations for secondary students (Source 10); FKGL reduction predicts improved comprehension (Source 3); simplification functions as a “worked example” that lowers extraneous and intrinsic load (Source 4).
H0–1: There is no significant difference in post-test comprehension scores between the experimental and control groups.
Secondary hypothesis 1 — Science attitude (H2)
H2: Students in the experimental group will show a significantly greater positive change in TOSRA attitude scores (post minus pre) than students in the control group. Justification: successful, lower-effort comprehension is expected to improve attitude toward scientific inquiry as measured by the validated Spanish TOSRA (Sources 5, 8).
H0–2: There is no significant difference in TOSRA attitude change between the experimental and control groups.
Secondary hypothesis 2 — Comprehension–attitude correlation (H3)
H3: Within the experimental group, comprehension gain (post minus pre) will be positively correlated with attitude change (post minus pre TOSRA), consistent with the thesis that comprehension gains drive attitude change rather than the reverse (Sources 4, 5).
H0–3: There is no significant correlation between comprehension gain and attitude change within the experimental group.
Section B — Experimental Design
Design. Pre-test/post-test control-group quasi-experimental design with two parallel groups (experimental vs. control), measured on comprehension and attitude before and after a single reading intervention.
Why quasi-experimental. A true experiment with population-level random sampling is impossible for an unaffiliated, zero-budget researcher working with a single available class. Quasi-experimental designs are explicitly recommended for causal inference under exactly these real-world constraints, provided the researcher transparently documents confounding variables and the limits on statistical power (Source 13). The same source warns that small samples reduce power and raise Type II error risk; this is acknowledged in Section I and built into the analysis plan.
Why randomization within one school is acceptable. The study does not claim a nationally representative sample; it claims internal comparability between two groups drawn from the same pool. Random assignment of available participants to the two conditions equalizes, in expectation, baseline differences (prior knowledge, reading habits, English proficiency), which is the function randomization must serve here. Generalizability beyond the school is deliberately not claimed and is listed as a limitation (Sources 13, 16). This makes the design a randomized-assignment quasi-experiment: non-random sampling, but random allocation.
Random group-assignment procedure (free tools). After consent is obtained, each participant receives a sequential ID (1, 2, 3 …). Primary method: enter the IDs in a free Google Sheet, generate a random number for each with =RAND(), sort ascending, and assign the top half to the control group and the bottom half to the experimental group. Backup method (no computer): a coin flip per participant, re-balancing by reassigning the last few flips if one group exceeds the other by more than one. Both methods are documented in the lab notebook with date and the random seed/sheet retained as evidence.
Section C — Variables
Independent variable
Definition. Type of text the participant reads (manipulated, two levels).
•	Experimental condition: the Paper-to-Human output, specifically Version 2 (adult without university education), selected as the closest match to a high school reading level.
•	Control condition: the original “Gender Shades” academic paper (full text, unaltered PDF).
The manipulation is the presentation/complexity of identical underlying content, holding the scientific substance constant across conditions (Source 4).
Dependent variable 1 — Comprehension
Instrument. A 7-question multiple-choice test written specifically for the “Gender Shades” paper. Scored objectively 0–7 (one point per correct answer).
Question composition (chosen to separate surface recall from deep understanding, directly addressing Counterargument 1, Sources 1 and 4):
Question type	Count	What it measures
Factual recall	2	Surface facts stated directly in the text (e.g., which groups had highest error rates).
Basic inference	3	Combining two stated facts to reach a conclusion not stated verbatim.
Conceptual understanding	2	Transfer of the core idea to a new situation — the deep-comprehension probe.
Reporting comprehension and conceptual sub-scores separately lets the study test whether FKGL reduction improves surface recall without necessarily improving deep understanding — the precise risk raised by Sources 1 and 4.
Dependent variable 2 — Science attitude
Instrument. The Spanish-adapted Test of Science-Related Attitudes (TOSRA), validated with 664 secondary students; total Cronbach’s α = 0.94, KMO = 0.94, no significant gender differences (Sources 5, 6).
Subscales used (3 of 7) and rationale: 
•	Social Implications of Science — matches the AI-ethics theme of the source paper; students evaluate science’s impact on society.
•	Attitude to Scientific Inquiry — directly captures whether the intervention changes willingness to engage with how science is done.
•	Leisure Interest in Science — the construct most aligned with the behavioral follow-up (seeking out science texts voluntarily).
Item reduction (70 → 21). Using all 7 subscales (70 items) twice (pre and post) is infeasible in the 3-week, single-session timeline and would induce fatigue that adds extraneous load and measurement error (Source 4). Restricting to the three theoretically relevant subscales at 7 items each (21 items total) preserves the constructs most relevant to the hypotheses while keeping each administration under ~7 minutes. Items retained are those with the highest reported loadings within each subscale (Sources 5, 6).
Scoring. Five-point Likert (1 = strongly disagree to 5 = strongly agree), negatively worded items reverse-scored; a mean score (1–5) is computed per subscale and a total mean across the 21 items.
Objective text-complexity measure (manipulation check)
FKGL and the SMOG Index are computed for four texts: the original paper, and Paper-to-Human Versions 1, 2, and 3. Two indices are used because FKGL correlates with abstractness but does not capture referential or deep cohesion (Source 1); reporting SMOG alongside it gives a second, syllable-based estimate and a more honest complexity picture.
Tool. The free Python textstat library (or a free online calculator). English texts are scored as written; Spanish outputs are additionally screened with a Spanish-adapted readability index and reported with the caveat that FKGL/SMOG are English-calibrated.
Reporting template (values filled after generation and fact-checking):
Text	FKGL	SMOG
Original paper (“Gender Shades”)	[X.X]	[X.X]
Paper-to-Human Version 1 (age 12)	[Y.Y]	[Y.Y]
Paper-to-Human Version 2 (adult, no university)	[Y.Y]	[Y.Y]
Paper-to-Human Version 3 (professional)	[Y.Y]	[Y.Y]
Control variables (held constant for all participants)
•	Same source paper for every participant.
•	Same physical environment and identical time allocation per phase.
•	Same instructions, read aloud verbatim from a script.
•	No discussion between participants during any session.
•	Researcher absent during the reading phase to reduce experimenter/demand effects.
Confounding variables (measured and used as covariates)
These directly address Counterargument 2 (complexity is not the sole barrier; vocabulary, background knowledge, and fluency also predict comprehension — Sources 1, 3):
•	Prior knowledge of AI ethics — 2-question pre-screen.
•	English proficiency — self-reported 1–5 scale.
•	Reading habits — one question: books read per month.
Because random assignment is expected to balance these across groups, they are reported per group as a balance check and, where group means diverge, discussed as covariates qualifying the interpretation (Source 13).
Section D — Participants
Inclusion criteria
•	Currently enrolled at Colegio Azcapotzalco.
•	Age 14–17.
•	No prior formal coursework in AI or computer science.
•	Parental consent obtained.
Exclusion criteria
•	Self-reported learning disability affecting reading comprehension.
•	Prior knowledge of the specific paper selected.
Sample size justification
Target: N = 24 (12 per group), minimum. With a sample this small, only large effect sizes (Cohen’s d > 0.8) are statistically detectable, and the design cannot fully control confounding (Source 13). This is accepted deliberately: the study is framed as a preliminary, hypothesis-generating investigation for future larger-scale replication, not a definitive test. Two cautions are carried into interpretation — small-sample studies tend to over-report effect sizes (Source 16), and conventional Cohen’s d benchmarks may overestimate effects in educational interventions (Source 15). N = 24 is therefore a floor for feasibility, with up to 30 participants enrolled if available.
Random assignment protocol. After consent, assign sequential participant numbers, then allocate to groups using the Google Sheets =RAND() procedure (Section B), retaining the sheet as documentation.
Section E — Procedure
The core study runs in a single session on Day 1 (three phases, ~70 minutes total), with a behavioral follow-up on Day 15. The one-shot single-session model is supported by Source 8, which obtained significant comprehension gains from a comparable one-shot AI-simplification intervention.
Phase 1 — Pre-test (Day 1, 20 minutes)
Step 1. Distribute and collect consent/assent forms one week in advance (see Section H).
Step 2. Seat participants in individual spaces with no line of sight to one another.
Step 3. Distribute the pre-test packet, containing, in order: (a) 2-question AI-ethics prior-knowledge screen; (b) English proficiency self-report (1–5); (c) reading-habits question (books/month); (d) 21-item TOSRA attitude pre-measure; (e) 7-question comprehension pre-test based on the paper’s abstract only, not the full text.
Step 4. Collect all materials. No discussion.
Phase 2 — Intervention (Day 1, immediately after, 30 minutes)
Step 5. Distribute reading materials by group — Control: original full-text paper (PDF/print); Experimental: Paper-to-Human Version 2 (fact-checked).
Step 6. Participants read independently within a 25-minute window, without time pressure inside that window. Researcher absent.
Step 7. Collect all reading materials.
Phase 3 — Post-test (Day 1, immediately after reading, 20 minutes)
Step 8. Distribute the post-test packet: (a) the same 7 comprehension questions as the pre-test; (b) the 21-item TOSRA attitude post-measure; (c) one open-ended question — “Did you find this text useful? Would you look for more texts like this?”
Step 9. Collect all materials. Session complete.
Phase 4 — Two-week follow-up (Day 15, 5 minutes)
Step 10. Send a Google Form to all participants with three questions: (1) “Since our session, have you searched for any scientific paper or research article on your own? (Yes/No)”; (2) “If yes, what topic?”; (3) “How confident do you feel about your ability to understand a scientific paper today? (1–5)”
Step 11. Record response rate and results. This measures behavioral change — a stronger signal of durable attitude shift than self-report alone, and a partial response to Counterargument 3 (one-time exposure may produce only temporary state change; Sources 5, 8).
Section F — Statistical Analysis Plan
All inferential tests are non-parametric, matching ordinal/small-sample data (Sources 12, 14). Analyses are pre-specified to avoid post-hoc fishing.
Analysis 1 — Text-complexity verification (manipulation check)
Report FKGL and SMOG for the original paper and all three Paper-to-Human versions (table in Section C). Descriptive only — no inferential test. This establishes that the independent variable was actually manipulated (the tool reduced measured complexity).
Analysis 2 — Comprehension between groups (tests H1)
•	Primary test: Mann-Whitney U on post-test comprehension scores, experimental vs. control (Sources 12, 14).
•	Within-group test: Wilcoxon signed-rank on pre vs. post within each group separately (Sources 12, 14).
•	Effect size: Cohen’s d (and/or rank-biserial r), interpreted with the explicit caveat that benchmarks may overestimate educational effects (Source 15) and that small samples inflate reported effects (Source 16).
•	Report: mean rank, U, p-value, effect size, and a plain-language practical interpretation.
Analysis 3 — Attitude between groups (tests H2)
Apply the same tests as Analysis 2 to TOSRA scores: Mann-Whitney U between groups and Wilcoxon signed-rank within groups, reported both per subscale (Social Implications, Scientific Inquiry, Leisure Interest) and for the 21-item total.
Analysis 4 — Comprehension–attitude correlation (tests H3)
Spearman’s rank correlation between comprehension gain (post − pre) and attitude change (post − pre TOSRA), experimental group only. Report ρ and p-value. A positive, significant ρ supports the thesis that comprehension gains drive attitude change.
Analysis 5 — Follow-up behavioral data
Descriptive only: percentage of experimental vs. control participants who reported independently searching for a paper at two weeks, plus mean confidence (1–5). No significance testing, given small N and binary responses.
Section G — Hallucination Mitigation Protocol
This protocol addresses Counterargument 4: LLMs can generate plausible but inaccurate content, which in a scientific context could teach incorrect concepts and depress comprehension (Sources 10, 11). It runs before any output is used with participants.
Step 1. Generate Version 1, 2, and 3 outputs for the selected paper via the Claude API.
Step 2. Researcher reads the original paper in full.
Step 3. Compare each version against the original for: factual accuracy of all stated findings; correct representation of the main argument; no invented statistics or percentages; correct attribution of claims.
Step 4. Manually correct any inaccuracy found, re-checking the corrected text against the source.
Step 5. Document in the lab notebook: “AI output was fact-checked against the original source on [date]. X corrections were made to Version 1, Y to Version 2, Z to Version 3,” and retain both the raw and corrected outputs.
Source 11 specifically notes that reliable audience-level adaptation requires targeted prompt engineering rather than naive prompting; the prompt templates used for each version are therefore archived as part of the materials. This honesty converts “zero-cost” into “low-cost with researcher oversight.”
Section H — Ethical Framework
Consent protocol (Mexican context)
•	Dual consent: a parental/guardian permission form plus an adolescent assent form, both written at a 6th-grade reading level. In the Mexican legal context, both forms must reference compliance with the Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), specifically Article 36, which governs the processing of personal data of minors and requires explicit parental consent. The forms must also state that data will be used exclusively for academic research purposes and will not be shared with third parties, in accordance with Articles 8 and 17 of the same law.
•	Each form states: purpose; voluntary participation; the right to withdraw at any time; data anonymization; and that there are no academic consequences for participating or withdrawing.
•	Forms distributed and collected two weeks before the study date; verbal assent re-confirmed on the study day.
Data management
•	All data stored in a password-protected Google Sheet.
•	Participants identified by number only — never by name.
•	Raw data deleted after analysis is complete.
•	No individual data shared with school administration.
Equity safeguard (addresses Counterargument 6)
Because students with stronger digital literacy or baseline interest may benefit disproportionately, possibly widening rather than closing gaps (Sources 13, 16), results are disaggregated by the measured covariates (English proficiency, reading habits, prior knowledge) to check whether gains concentrate among already-advantaged students. Any such pattern is reported, not hidden.
Reporting negative results
If the tool shows no effect, the result is reported fully and honestly. A well-conducted null result is itself a contribution to the literature on AI in education in Latin American contexts.
Section I — Limitations
The following limitations are acknowledged transparently, as required for both quasi-experimental rigor and ISEF review.
1. Single-school sample. Participants come from one school, so findings may not generalize to other Mexican students or to other educational systems (Source 13).
2. Small sample, limited power. N = 24–30 can detect only large effects, raising Type II error risk; small-sample studies also tend to over-report effect sizes, and standard Cohen’s d benchmarks may overstate educational effects (Sources 15, 16).
3. One-time exposure. A single session may produce temporary state change in attitude rather than durable trait change, which typically requires repeated, contextually relevant exposure; the two-week follow-up only partially mitigates this (Source 8).
4. FKGL/SMOG do not capture cohesion. These indices track abstractness and surface difficulty but not referential or deep cohesion, so a measured complexity drop does not guarantee an equivalent drop in conceptual difficulty (Source 1).
5. Possible self-selection bias. Volunteer participants may differ systematically (e.g., higher baseline science interest) from non-volunteers.
6. Developer-as-evaluator bias. The researcher is also the tool’s developer, creating potential confirmation bias in the manual fact-checking step (Sources 10, 11). Archiving raw and corrected outputs, and ideally a second independent checker, mitigates this.
7. Preliminary findings. Results require replication with a larger, multi-school sample before any causal or policy claim is warranted (Sources 13, 16).
Section J — ISEF Research Plan
Title
Can AI Make Science Readable? Testing Paper-to-Human on Comprehension and Attitude in Mexican High School Students.
Question / Problem
Mexican high school students rarely engage with scientific literature because academic papers are written in English and at a reading level far above their own, creating cognitive overload (Sources 2, 3, 4). This study asks whether an AI tool that translates a paper into a simpler version raises both comprehension and positive attitude toward science compared with reading the original.
Hypothesis
(H1) The experimental group will score significantly higher on a comprehension post-test than the control group. (H2) The experimental group will show significantly greater positive change in science attitude (TOSRA). (H3) Within the experimental group, comprehension gains will correlate positively with attitude change.
Procedures
1. Select the open-access paper “Gender Shades” (Buolamwini & Gebru, 2018).
2. Generate Paper-to-Human Versions 1–3 via the Claude API; fact-check against the original (Section G).
3. Compute FKGL and SMOG for all four texts as a manipulation check (Source 1).
4. Obtain dual parental consent and adolescent assent two weeks ahead.
5. Enroll 24–30 eligible students; assign to control or experimental group with a Google Sheets random-number procedure.
6. Day 1, Phase 1 (20 min): administer pre-screen, covariate questions, TOSRA (21 items), and a 7-question comprehension pre-test on the abstract.
7. Day 1, Phase 2 (30 min): control reads the original paper; experimental reads Version 2; researcher absent.
8. Day 1, Phase 3 (20 min): administer the 7-question comprehension post-test, TOSRA post-measure, and one open question.
9. Day 15: send a 3-question Google Form measuring independent paper-seeking behavior and confidence.
10. Analyze with Mann-Whitney U, Wilcoxon signed-rank, Spearman correlation, and effect sizes (Sources 12, 14, 15, 16).
Risk and Safety
Minimal-risk study involving human participants who are minors. No physical, biological, or chemical hazards. The only risks are mild fatigue or discomfort from testing, mitigated by short instruments and the right to withdraw without penalty. Dual informed consent (parental permission + adolescent assent) is obtained in advance; data are anonymized by participant number, stored password-protected, and deleted after analysis. No deception is used. Researcher should confirm whether a local IRB/ethics committee or ISEF SRC pre-approval applies before data collection.
Data Analysis
Descriptive complexity comparison (FKGL, SMOG). Between-group comparisons via Mann-Whitney U on comprehension and TOSRA post scores; within-group pre/post via Wilcoxon signed-rank. Spearman’s ρ for the comprehension–attitude relationship in the experimental group. Effect sizes (Cohen’s d / rank-biserial r) reported with caveats from Sources 15 and 16. Follow-up behavior reported descriptively. α = 0.05.
Bibliography (APA)
References are ordered by the source numbers used in-text. Entries marked (n.d.) lack a publication year in the provided record and should be confirmed by the researcher against the source before final submission.
Source 1.  Solnyshkina, M., et al. (n.d.). Evaluating text complexity and Flesch-Kincaid grade level. Journal of Social Studies Education Research. https://jsser.org/index.php/jsser/article/view/225
Source 2.  Nature Index. (n.d.). Science is getting harder to read. Nature. https://www.nature.com/nature-index/news/science-research-papers-getting-harder-to-read-acronyms-jargon
Source 3.  Text readability: Its impact on reading comprehension and reading time. (2024). Journal of Education and Learning (EduLearn). http://edulearn.intelektual.org/index.php/EduLearn/article/view/21724
Source 4.  Cognitive load theory and individual differences. (2024). Learning and Individual Differences. ScienceDirect. https://www.sciencedirect.com/science/article/pii/S1041608024000165
Source 5.  Navarro, M., et al. (2016). Attitudes toward science: Measurement and psychometric properties of the Test of Science-Related Attitudes for its use in Spanish-speaking classrooms. International Journal of Science Education, 38(9), 1459–1482. https://ui.adsabs.harvard.edu/abs/2016IJSEd..38.1459N/abstract
Source 6.  Navarro, M., et al. (2016). Attitudes toward science: Measurement and psychometric properties [Full PDF]. https://pendidikankimia.walisongo.ac.id/wp-content/uploads/2018/10/navarro2016.pdf
Source 7.  [Entry removed — citations previously attributed to Source 7 redistributed to Sources 12 and 14, which cover Mann-Whitney U and Wilcoxon signed-rank with peer-reviewed authority. Renumber bibliography before ISEF submission.]
Source 8.  Does AI simplification of authentic blog texts improve reading comprehension, inferencing, and anxiety? A one-shot intervention in Turkish EFL context. (2024). International Review of Research in Open and Distributed Learning (IRRODL). https://www.irrodl.org/index.php/irrodl/article/view/7779
Source 9.  Siddharthan, A. (2014). A survey of research on text simplification. ITL – International Journal of Applied Linguistics, 165(2), 259–298. http://www.jbe-platform.com/content/journals/10.1075/itl.165.2.06sid
Source 10.  Humanizing AI in education: A readability comparison of LLM and human-created educational content. (2024). SAGE Journals. https://journals.sagepub.com/doi/10.1177/10711813241261689
Source 11.  ChatGPT, can you make this text easier? Investigating the utility of LLMs in easing text readability. (2025). International Journal of Artificial Intelligence in Education. Springer. https://link.springer.com/article/10.1007/s40593-025-00520-7
Source 12.  Ciencias o letras: Prueba de la U de Mann-Whitney. (n.d.). Revista Anestesiar. http://www.revistaanestesiar.org/index.php/rear/article/view/1136
Source 13.  Quasi-experimental designs for causal inference: An overview. (2024). Asia Pacific Education Review. Springer. https://link.springer.com/article/10.1007/s12564-024-09981-2
Source 14.  Statistics corner: Wilcoxon-Mann-Whitney test. (n.d.). Journal of Postgraduate Medicine, Education and Research (JPMER). https://www.jpmer.com/doi/10.5005/jp-journals-10028-1613
Source 15.  Kraft, M. A. (2020). Interpreting effect sizes of education interventions. Educational Researcher, 49(4), 241–253. http://journals.sagepub.com/doi/10.3102/0013189X20912798
Source 16.  Slavin, R., & Smith, D. (n.d.). The relationship between sample sizes and effect sizes in systematic reviews in education. Educational Evaluation and Policy Analysis. http://journals.sagepub.com/doi/10.3102/0162373709352369
Final Assessment — Three Weakest Points and How to Strengthen Them
Weakness 1 — Developer is also the fact-checker (confirmation bias)
Why it matters: The researcher built Paper-to-Human and also judges whether its outputs are accurate, so subtle errors favorable to the tool may pass (Sources 10, 11; Limitation 6).
Zero-budget fix: Recruit one science teacher or one classmate not in the study to independently fact-check the AI outputs against the original paper using the same Section G checklist, and report inter-checker agreement (e.g., number of disagreements). This costs nothing and converts a single biased judgment into a verifiable one.
Weakness 2 — Underpowered sample cannot detect realistic effects
Why it matters: At N = 24–30, only very large effects are detectable; a true but moderate benefit would likely be missed (Type II error), and any significant effect found may be inflated (Sources 13, 15, 16; Limitation 2).
Zero-budget fix: Maximize within-subject sensitivity and report it honestly: pre-register the analysis plan (free on OSF), emphasize the within-group Wilcoxon pre/post tests and the Spearman correlation (which use each participant as their own control and are more powerful at small N), and report confidence intervals rather than only p-values. Also enroll the full 30 rather than the 24 floor wherever possible.
Weakness 3 — FKGL drop may not equal deeper understanding
Why it matters: A lower FKGL/SMOG score shows surface simplification, but cohesion and intrinsic conceptual load may be unchanged, so comprehension gains could be limited to factual recall rather than real understanding (Sources 1, 4; Limitation 4).
Zero-budget fix: Analyze the comprehension test by question type — report factual-recall, inference, and conceptual sub-scores separately (the test is already designed 2/3/2 for this). If the experimental group gains on conceptual items, not just recall, that is direct evidence the intervention reaches deep comprehension; if it gains only on recall, the limitation is demonstrated honestly. This requires no new data, only disaggregated scoring.
