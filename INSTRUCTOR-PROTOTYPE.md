# ACC3000 instructor workbook builder

The macro generator is served at `instructor/` and the separate grading site at
`grading/`, with independent HTML pages and JavaScript entry points. The existing student practice
page and its legacy answer map are unchanged. New instructor variants must be
graded in the grading site with their original receipt and recorded checksum.

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
   Retain `INSTRUCTOR_ONLY/Receipt.json` and the checksum CSV privately.
5. Students open the workbook in desktop Excel, use its original **Generate Data**
   button once, complete the designated Solution cells and the image instructions
   below the questions, and save as `.xlsm`.
6. On the separate **grading site**, load the original receipt, enter the recorded
   checksum (required), and select saved student workbooks from that same version. Download the
   results CSV if needed. No command-line Python operation is required.

The browser loads Python/Pyodide from its pinned CDN on first grading use. ZIP,
image creation and integrity checks run locally. No AI service, API key, database,
paid host or grading server is needed. Refreshing discards the in-memory receipt
and results; retain the downloaded files.

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

- Public assignment metadata, question text, answer-cell coordinates, product
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

Grading requires an instructor-entered checksum that appears in the original
receipt. It must also match the selected workbook version and the checksum
recomputed from that submission. Blank, incomplete and unrecorded checksums block
grading. This confirms the issued content, not the identity of its creator.
There is no secret or answer key in the public website. Custom XML in
the workbook contains public assignment metadata, not the image-answer token or
target box, except when the instructor intentionally requests a plain-text
accommodation. Image answers exist as pixels and in the private receipt.

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
