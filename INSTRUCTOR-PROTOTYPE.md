# ACC3000 instructor workbook builder

The macro generator is served at `instructor/` and the separate grading site at
`grading/`, with independent HTML pages and JavaScript entry points. The existing student practice
page and its legacy answer map are unchanged. New instructor variants must be
graded in the grading site with the instructor’s recorded checksum. No receipt upload is needed.

## Use

1. Open the instructor page. The original sales-case `.xlsm` is bundled with the
   website; no template upload is needed.
2. Choose the course, assignment code and seed. Each batch contains five versions. Select question
   shuffling, product codes, question months, source-data scaling and one or two
   image checks. Optionally assign one student ID per version.
3. Optionally preview every version. The arrow buttons move a question and update its answer
   cell map. Choose a clear image or light background lines; a plain-text
   accommodation is available.
4. Click **Generate five workbooks** directly, or after reviewing the preview,
   and download the instructor package. Distribute only `workbooks/*.xlsm`.
   The grading map is saved privately in this browser's IndexedDB, keyed by checksum.
   Retain the checksum CSV and `INSTRUCTOR_ONLY/Receipt.json` as a private backup.
5. Students open the workbook in desktop Excel, use its original **Generate Data**
   button once, complete the designated Solution cells and the image instructions
   below the questions, and save as `.xlsm`.
6. In the same browser/profile, on the separate **grading site**, enter the recorded checksum (required)
   and select saved student workbooks from that same version. Download the
   results CSV if needed. No command-line Python operation is required. On another
   browser or after site storage is cleared, use **Restore private grading records**
   on the generator page once before grading. The grading page has no JSON upload.

The browser loads Python/Pyodide from its pinned CDN on first grading use. ZIP,
image creation and integrity checks run locally. No AI service, API key, hosted database,
paid host or grading server is needed. Refreshing discards the in-memory results; retain the downloaded files.

## Data and macro preservation

The original workbook is never modified. The browser starts from a ZIP copy,
retains `xl/vbaProject.bin` and the native form-control parts byte for byte, and
patches the worksheet XML. This path preserves native VBA and its Generate Data
button, which the general spreadsheet export API does not export.

Every issued copy resets the cover as the active sheet, with Solution, Sales,
Warranties & Returns and Reference hidden, no locked copies yet, and a blank
generation timestamp. The original VBA/button remain unchanged. Students press
Generate Data in Excel to unhide and prepare their working sheets.

The supplied workbook's cached simulation data are frozen before issue. Optional
seeded integer factors scale each product's units and claims together, and scale
its prices and revenue consistently. This preserves unit claim rates, claim lags
and clearance price ratios; it is not a new independent stochastic simulation.
Question months and identifiers vary separately. The original macro then
performs its normal freeze/copy/protect workflow. It does not re-randomize these
already fixed versions.

The original source-generation formulas remain available in the unchanged base
workbook. These variants deliberately issue a fixed dataset so an instructor can
retain its trusted source fingerprint before students receive the file.

## Integrity contract

The SHA-256 assignment checksum binds:

- The private assignment definition, question text, answer-cell coordinates, product
  identifiers and optional assigned student ID.
- The canonical values of both protected original source tables.
- The bytes, count and locations of the instruction images.

The verifier also checks the displayed checksum, question labels, labeled box
colors, required generated/protected sheets and the absence of merged answer
boxes. The existing Python grader checks identity fields, the frozen locked
timestamp and the issued ten numerical answers. Uncached formulas remain
unavailable; misplaced answers are not searched for elsewhere.

Answers and student-entered identity fields are excluded from the digest. Their
ordinary edits and Excel's XML reserialization do not invalidate the assignment.
The final digest excludes the mutable VBA container because Excel legitimately
rewrites it when new worksheet modules are added. Native VBA is preserved and
checked byte for byte at issue, not cryptographically authenticated after saving.

Grading requires an instructor-entered checksum and its saved private record in
the instructor browser. The definition is read from IndexedDB, never from the
student workbook, and combined with recomputed source/image hashes and verified
worksheet labels before Python scoring. Blank, incomplete, unknown and mismatched
checksums block grading. This confirms issued content, not the identity of its creator.

New student workbooks contain no grading-map Custom XML, issuer seed, answer-cell
map, expected image response or response commitment. Only the human-facing
questions, figures, entry cells and assignment checksum travel with the student
file. The optional plaintext accommodation intentionally adds a text equivalent.
The private record, including expected image responses, stays in IndexedDB and
the instructor-only archive. No records are uploaded to a server or checked into
the public repository. IndexedDB is local storage, not an authenticated instructor
account: use a private browser profile and keep the archive out of student files.
Clearing site storage removes records; the JSON archive restores them. Earlier
private archives remain supported; old distributed files are not retroactively
stripped of their embedded maps and should be replaced with newly generated copies.

The default path diagram asks the student to follow a connected path from START
to a numbered endpoint and match its symbol to one of three boxes. Extracting
text alone does not specify the selected endpoint. Clear-text and plain-text
accommodation options remain available. This is a visual reasoning exercise,
not a validated human/AI discriminator. No adversarial text, hidden instructions
or promise that a model will skip OCR is used.

Technical correctness is reported out of ten; image completion is reported
separately. An image passes only when the token is in the indicated box and the
other two boxes are empty. A version mismatch is rejected for grading, not
classified as misconduct. The prototype does not authenticate student identity,
prevent redistribution of an issued workbook, detect all copied work, or prove
that no AI assistance was used. Vision-capable AI may read these images. Claims
about deterrence or learning require a separate evaluation; no new pilot or IRB
coverage is claimed by this implementation.

## Validation

Node tests cover unique/reordered cell maps, reproducible variation, scaling and
canonical checksums. Python tests exercise the original scoring logic through the
instructor adapter, including blank/misplaced answers, missing source copies,
assigned IDs and timestamps. Existing student-site tests remain in place.

Desktop Excel validation on 2026-10-23 opened an issued version, ran the original
Generate_Data macro, and saved a completed demonstration with both instruction
images. The browser accepted that save with the original checksum, returned 6/10
technical points and 1/2 image checks, returned 5/10 after a correct answer was
moved outside its box, and rejected changed source data, labels, images and a
different recorded checksum. This validates the tested Excel environment, not
every Excel version or alternative spreadsheet application.

Browser ZIP support: JSZip 3.10.1, MIT license; retained in
`dist/instructor/vendor/JSZIP-LICENSE.md`. https://github.com/Stuk/jszip

On 2026-10-23, the checksum-only update passed 17 Node and 10 Python tests.
All five newly generated path-diagram workbooks opened on the cover and ran the
original macro in desktop Excel. A saved demonstration received 6/10 numerical
points and 1/1 image checks without a receipt; moving its token to another box
retained 6/10 technical points and returned 0/1 image checks.

Student-facing cue review: generated copies omit the Visual instruction heading
and cover reminder about the figure. Drawing object names/descriptions and
media filenames use neutral Figure labels; color labels contain only the color
name. The instructor preview no longer exposes the expected response in alt text.
The optional worksheet text equivalent remains an explicit accommodation. The
image itself still contains directions for students. The grading definition is now
private to the instructor browser. Visible questions and figures still allow AI
to infer tasks; no resistance to AI is claimed.

The separate-map update passed 18 Node and 10 Python tests. Manual browser
validation confirmed automatic record persistence across reloads, 6/10 technical
scoring and 1/1 versus 0/1 image scoring. All five workbooks ran the native macro
in Excel. ZIP inspection of all five issued files and a completed Excel save
confirmed no grading-map XML, issuer seed, response commitment or redundant
Visual instruction label was present.
