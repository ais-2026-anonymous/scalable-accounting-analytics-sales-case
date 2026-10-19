# Autograder: browser practice tool

The static `dist/` site runs the existing case computations in Python/Pyodide,
then offers optional feedback from a Qwen3-4B model trained on synthetic case
examples. GitHub Pages serves the static site; Python grading runs locally.
Optional inference runs on the public Hugging Face ZeroGPU Space
`hunterng/Accounting-Autograder-Feedback`. It receives only the selected checker
finding, case rules and optional student explanation. Workbook files, raw rows,
identity fields, filename, timestamp and numerical expected answers are excluded.
There is no application database or content logging; hosting platforms may
retain request metadata or service logs. Client run-history recording is disabled.

## Student use

Use desktop Excel to generate a working copy of the supplied case, complete the
designated Solution boxes, recalculate and save. Select the saved workbook in
the site. The site does not execute VBA or recalculate Excel formulas. The
practice sample contains four deliberate mistakes and scores 6/10.

Students need no WebGPU or model-weight download. One Get feedback action
connects to the public service; the same button cancels pending feedback.
Free ZeroGPU has queues and daily GPU quotas, so it does not guarantee classroom
capacity or continuous availability. No paid fallback is configured. Grading
and rubric hints remain usable if inference is unavailable. Clearing the session
or refreshing discards local work; downloaded feedback remains on the student's
device. Previously sent inference requests cannot be recalled from the host.

## Grading contract

`dist/grader.py` is the sole scoring engine. Its adapted computations follow
the original current two-product sales grader; source-file hashes are retained
in `reference/provenance.json`. Confidential original scripts and instructor
workbooks are not included. Ten technical cells receive one point each:
B7, B8, B12, B13, B14, B15, B19, B20, B24 and B25. These prototype point weights
need instructor approval. Visual, graph and written-report assessment is excluded.

The reader accepts genuine `.xlsx`/`.xlsm` OOXML files up to 20 MB and rejects
unsupported formats, disguised files, external workbook links, invalid layout
and missing required generated/protected sheets with zero. B1:B3 identifiers
and a frozen, plausible, locked timestamp in B4 are structurally checked.
Answers outside designated boxes are not searched for; a blank box earns zero.
Missing formula caches also earn zero until recalculated and saved, but do not
establish an accounting misconception.

Revenue is summed for the specified product and year-month; price is matched
revenue divided by units. Return rates pair t+1 claims with original units at t;
warranty rates pair t+2 claims with original units at t. Clearance uses the
recurring lower-price month. Concept mode normalizes decimal/percentage values;
the documented legacy comparison mode preserves formatted-CSV conventions.
See `dist/grader-contract.json` for tolerances and implementation details.

The macro does not save a reproducible dataset seed. A source-value fingerprint
is an identifier, not a seed or proof of authenticity. Timestamp and protection
checks do not cryptographically authenticate a workbook. Stateless checking
cannot compare submissions across students. Browser code is inspectable; this
is formative practice rather than an authenticated high-stakes grading system.

## Personalized feedback and training

Only the selected Python rubric finding, case rules and optional explanation
enter the model. Source rows, identifiers, filename, timestamp and numerical
expected answers do not. Nineteen technical mistake categories support possible
diagnoses; a matching numerical pattern is not proof of the student's method.
The model generates prose, an Excel next step and an understanding question.
Limited code checks preserve the Python verdict and reject some inconsistent
responses, but cannot establish that all generated accounting claims are true.
The model cannot change grades. Instructor review is needed.

The deployed candidate is a Qwen/Qwen3-4B QLoRA fine-tune (rank 8, 60 optimizer
steps, two examples per step). The pool contains 360 synthetic examples; this
run processed 120 example exposures. The 120 held-out wording variants share
authored case families and are not independent student/instructor examples.
Targets are not instructor approved. Loss improvements do not establish useful
feedback, accounting expertise or student learning gains.

`training/` includes the exact synthetic data, hashes, requirements and reports.
`tools/train_model.py` and `tools/export_web_weights.py` reproduce training and
export with a separately downloaded base model and CUDA environment. The data
generation scripts additionally require the confidential local instructor
fixture; the supplied training JSONL files do not. The adapter and exact compressed MLC updates are published on Hugging Face
with Apache-2.0 licensing. The retained browser worker can reconstruct the
previously tested quantized tensors, but is no longer loaded by the student UI.
The Space loads the pinned Qwen3-4B base in FP16 and the same pinned PEFT adapter.
This differs from the earlier quantized browser runtime; prior browser evaluation
does not establish hosted-model equivalence. Space source and pinned dependencies
are in `space/`. Deploy it with `HfApi.upload_folder(..., repo_type='space')`
using saved local credentials, never credentials in browser files.
`tools/build_weight_deltas.py` packages exact compressed browser updates after
export, using a pinned MLC base revision and verifying its cached files. Generated
model payloads are ignored by Git and hosted separately on Hugging Face.
`dist/model-host.json` pins the exact model repository commit.

## Deployment and verification

GitHub Actions validates the public practice sample, rejects unsupported and
disguised files, rejects the ungenerated simulator, checks the feedback contract,
then publishes only `dist/`. It requires a pinned model revision before deploy.
The Space is called anonymously through the bundled Gradio JavaScript client.
No API key or Hugging Face token belongs in browser code or this repository.

For local use:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory dist
node --test tests/coach.test.mjs
python -m unittest discover -s tests -p 'test_public_practice.py'
```

The original implementation passed eleven Python checks against private
fixtures, twenty JavaScript checks, browser grading/format/mobile checks and
seven actual-model feedback scenarios. Public tests are a smaller portable
subset. None of these checks is a classroom learning-outcomes study or an
exhaustive device compatibility guarantee.

The existing anonymous generator publication is reused in `dist/assets/`, so
its metadata matches the root workbook. Original manuscripts, local paths,
credentials, student records and confidential answer fixtures are excluded.
