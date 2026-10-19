---
title: Autograder Feedback
emoji: 📘
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 5.49.1
python_version: '3.12'
app_file: app.py
suggested_hardware: zero-a10g
---

# Autograder feedback service

Free ZeroGPU inference for the companion static
[Autograder](https://ais-2026-anonymous.github.io/scalable-accounting-analytics-sales-case/).
The Space loads the published Qwen3-4B base and the existing trained LoRA adapter.
No retraining or paid Inference Provider is involved. ZeroGPU imposes queues and
daily per-visitor quotas; availability and response time are not guaranteed.

The browser's Python grader assigns every point. This service receives selected
rubric findings and an optional explanation, not the uploaded Excel workbook,
identifying cells, or expected numerical answers. It returns tutoring prose and
cannot change the browser's grade. The application has no database, flagging or
request-content logging. Hugging Face may retain platform logs and request
metadata; this is remote processing, not an offline or wholly private workflow.

The synthetic fine-tune is experimental and has not been instructor validated.
See the model card and training reports in the companion repositories. The
server uses the FP16 base plus the trained adapter; it is not the browser's
four-bit export, so generation can differ and requires its own checks.

API: `/feedback`, one JSON request produced by the site's `tutorRequest` helper,
one JSON string response. Inputs and generation lengths are bounded. GPU work
has a 35-second limit. Only the free `zero-a10g` hardware is intended here.
