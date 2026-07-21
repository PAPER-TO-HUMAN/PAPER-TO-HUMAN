# Paper-to-Human — Product Specification
## For Claude Code / VSCode Session

---

## 1. Project Context

Paper-to-Human is an AI-powered research tool built as part of a
scientific study on AI-mediated complexity translation. The tool
transforms a single academic paper into three simultaneous versions
adapted to different comprehension levels. It serves two purposes
simultaneously:

1. A functional product for democratizing scientific literature access
2. The intervention instrument in a quasi-experimental ISEF study
   measuring comprehension and science attitude in Mexican high school
   students

The study uses Buolamwini & Gebru "Gender Shades" (2018) as the
source paper. All Claude API outputs must be fact-checked manually
before use in the study.

---

## 2. What the App Does (User-Facing)

The user:
1. Uploads a PDF or pastes a URL of an academic paper
2. Clicks "Translate"
3. Sees three versions generated simultaneously, displayed side by side
4. Sees a complexity score comparison table (FKGL + SMOG) for the
   original paper vs. each generated version
5. Can export/copy any version as plain text

---

## 3. Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **AI:** Anthropic Claude API (claude-sonnet-4-6 model)
- **PDF parsing:** pdf-parse (npm package)
- **Readability metrics:** text-readability (npm package) for FKGL
  and SMOG Index calculation
- **Deployment:** Vercel (free tier)
- **No database required for MVP**
- **No authentication required for MVP**

---

## 4. Core Features — MVP Only

### 4.1 Input Methods

**Method A — PDF Upload:**
- File input accepting .pdf only
- Max file size: 5MB
- Extract text using pdf-parse
- Show character count of extracted text

**Method B — URL Input:**
- Text field for paper URL
- Fetch URL server-side (Next.js API route) to avoid CORS issues
- Extract readable text from fetched HTML
- Show character count of extracted text

**Text truncation:** If extracted text exceeds 12,000 characters,
truncate to first 12,000 with a visible notice: "Text truncated to
12,000 characters for processing."

### 4.2 Three-Version Generation

Send the extracted paper text to the Claude API with three separate
prompts simultaneously (Promise.all). Generate:

**Version 1 — For a 12-year-old:**
- No scientific background assumed
- Target reading level: Grade 5-6 (FKGL 5-7)
- Language: simple, concrete, no jargon
- Analogies must use objects/situations from everyday life

**Version 2 — For an adult without university education:**
- High school reading level assumed
- Target reading level: Grade 8-9 (FKGL 8-10)
- Language: clear, accessible, minimal jargon
- This is the version used in the ISEF study intervention

**Version 3 — For a professional in the field:**
- Domain expertise assumed
- Maintains technical vocabulary
- Focuses on methodology and implications
- Target: FKGL 12-14

**Each version must contain exactly:**
1. A one-paragraph summary (max 150 words)
2. Three key concepts, each with:
   - Concept name (bold)
   - Plain-language explanation (2-3 sentences)
3. One real-world analogy that maps the paper's core finding
   to something concrete

### 4.3 Prompts (Exact Text — Do Not Modify)

Use these exact system and user prompts for the API calls.
The prompts are archived as part of the study materials.

**System prompt (same for all three versions):**
```
You are a science communication specialist. Your task is to
transform academic papers into accessible versions for specific
audiences. You must preserve factual accuracy completely —
never invent statistics, never change findings, never add
claims not in the original. If you are uncertain about a
fact, omit it rather than approximate it. Structure your
response exactly as specified.
```

**User prompt — Version 1 (12-year-old):**
```
Transform this academic paper for a 12-year-old with no
scientific background. Use simple words (Grade 5-6 reading
level). Avoid all jargon.

Structure your response EXACTLY like this, with these exact
headers:

SUMMARY
[One paragraph, maximum 150 words, explaining what the
researchers did and what they found]

KEY CONCEPTS
Concept 1: [name]
[2-3 sentences explaining this concept as if talking to a
curious 12-year-old]

Concept 2: [name]
[2-3 sentences]

Concept 3: [name]
[2-3 sentences]

REAL-WORLD ANALOGY
[One paragraph connecting the paper's core finding to
something a 12-year-old encounters in daily life]

PAPER TEXT:
{text}
```

**User prompt — Version 2 (adult, no university):**
```
Transform this academic paper for an adult who did not attend
university. Use clear, direct language (Grade 8-9 reading
level). Define any technical terms you must use.

Structure your response EXACTLY like this:

SUMMARY
[One paragraph, maximum 150 words]

KEY CONCEPTS
Concept 1: [name]
[2-3 sentences]

Concept 2: [name]
[2-3 sentences]

Concept 3: [name]
[2-3 sentences]

REAL-WORLD ANALOGY
[One paragraph]

PAPER TEXT:
{text}
```

**User prompt — Version 3 (professional):**
```
Transform this academic paper into a structured overview for
a professional in the relevant field. Maintain technical
vocabulary. Focus on methodology, findings, and implications.

Structure your response EXACTLY like this:

SUMMARY
[One paragraph, maximum 150 words]

KEY CONCEPTS
Concept 1: [name]
[2-3 sentences]

Concept 2: [name]
[2-3 sentences]

Concept 3: [name]
[2-3 sentences]

REAL-WORLD ANALOGY
[One paragraph connecting findings to professional practice]

PAPER TEXT:
{text}
```

### 4.4 Complexity Score Calculator

After generating the three versions, calculate and display:

| Text | FKGL | SMOG |
|------|------|------|
| Original paper | X.X | X.X |
| Version 1 (age 12) | X.X | X.X |
| Version 2 (adult) | X.X | X.X |
| Version 3 (professional) | X.X | X.X |

Use the `text-readability` npm package:
```javascript
import readability from 'text-readability'
const fkgl = readability.fleschKincaidGrade(text)
const smog = readability.smogIndex(text)
```

Display the complexity gap: "Paper-to-Human reduced reading
complexity from Grade [X] to Grade [Y] for the general audience
version — a reduction of [Z] grade levels."

### 4.5 Export Functionality

Each version panel has:
- A "Copy" button that copies the plain text to clipboard
- A "Download .txt" button that saves the version as a text file
  named: `paper-to-human-v1.txt`, `paper-to-human-v2.txt`,
  `paper-to-human-v3.txt`

The saved text file must include at the top:
```
Generated by Paper-to-Human
Date: [date]
Source: [filename or URL]
FKGL: [score] | SMOG: [score]
---
[content]
```

This header is required for the study's fact-checking protocol
(Section G of the methodology).

---

## 5. UI Layout

### 5.1 Page Structure

```
[Header: "Paper-to-Human" + subtitle]
[Input section: PDF upload OR URL field + Translate button]
[Loading state: progress indicator during API calls]
[Complexity table: shown after generation]
[Three-column output: V1 | V2 | V3]
[Footer: research context note]
```

### 5.2 Three-Column Layout

On desktop: three equal columns side by side
On mobile: stacked vertically, V2 first (study version)

Each column:
- Header badge: "Version 1: Age 12" / "Version 2: General Public"
  / "Version 3: Professional"
- FKGL badge: "Grade [X]" in color (green if ≤8, yellow if 9-12,
  red if >12)
- Content sections: Summary / Key Concepts / Analogy
- Copy + Download buttons at bottom

### 5.3 Research Context Note (Footer)

Display this exact text in a subtle footer:
"Paper-to-Human is part of an ISEF research study on AI-mediated
complexity translation. All outputs should be fact-checked against
the original source before use in academic or educational contexts."

---

## 6. API Route Structure

```
/api/translate
  POST
  Body: { text: string, source: string }
  Returns: {
    v1: { summary, concepts, analogy },
    v2: { summary, concepts, analogy },
    v3: { summary, concepts, analogy },
    metrics: {
      original: { fkgl, smog },
      v1: { fkgl, smog },
      v2: { fkgl, smog },
      v3: { fkgl, smog }
    }
  }

/api/fetch-url
  POST
  Body: { url: string }
  Returns: { text: string, title: string }
```

---

## 7. Error Handling

| Error | User Message |
|-------|-------------|
| PDF parse failure | "Could not extract text from this PDF. Try copying the text manually." |
| URL fetch failure | "Could not access this URL. Try downloading the PDF directly." |
| API timeout (>30s) | "Generation is taking longer than expected. Please try again." |
| Text too short (<200 chars) | "Not enough text to process. Please upload the full paper." |
| Claude API error | "Translation failed. Please try again in a moment." |

---

## 8. Environment Variables Required

```
ANTHROPIC_API_KEY=your_key_here
```

---

## 9. What NOT to Build in MVP

Do not build:
- User authentication or accounts
- Database or history storage
- Payment or usage limits
- Multiple paper comparison
- Spanish language output option
- Citation extraction
- Image handling from PDFs

These are post-MVP features. The MVP must be functional for the
ISEF study intervention by Day 5 of the build schedule.

---

## 10. Study-Specific Requirements

These requirements exist specifically for the ISEF study and must
not be removed or changed:

1. **Version 2 is the intervention version.** It must be clearly
   labeled as the "General Public" version and must target Grade
   8-9 FKGL. This is the version distributed to experimental
   group participants.

2. **Prompts must be archived.** The exact prompts used to generate
   outputs are part of the study's materials. Do not modify the
   prompts in Section 4.3 without documenting the change.

3. **FKGL and SMOG must both be calculated and displayed.**
   Both metrics are required by the study methodology. FKGL alone
   is insufficient.

4. **Export must include the header block.** The date, source,
   and scores in the exported file are required for the
   fact-checking protocol.

5. **The system prompt must explicitly prohibit hallucination.**
   The phrase "never invent statistics, never change findings"
   must remain in the system prompt.

---

## 11. First Claude Code Session — Build Order

Follow this order strictly. Do not skip ahead.

**Session 1 (Days 1-2): Core infrastructure**
1. Initialize Next.js project with Tailwind
2. Install dependencies: pdf-parse, text-readability, anthropic
3. Build /api/translate route with the three prompts
4. Build /api/fetch-url route
5. Test API routes with curl before building UI

**Session 2 (Day 3): UI**
1. Build input section (PDF upload + URL field)
2. Build loading state
3. Build three-column output layout
4. Connect UI to API routes

**Session 3 (Day 4): Metrics + Export**
1. Integrate FKGL/SMOG calculation
2. Build complexity table
3. Build copy + download buttons with header block

**Session 4 (Day 5): Testing + Deploy**
1. Test with Gender Shades paper (the ISEF study paper)
2. Verify FKGL scores match expected ranges per version
3. Deploy to Vercel
4. Generate and fact-check the three versions for study use

---

*This SPEC.md was generated from the Paper-to-Human research
methodology (Sections A-J) and should be read alongside
Paper-to-Human_Methodology_v2.docx before starting any
Claude Code session.*