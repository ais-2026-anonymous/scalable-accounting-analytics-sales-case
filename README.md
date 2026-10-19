# Scalable Accounting Analytics: Sales Case

Excel materials accompanying *Scalable Data Analytics Pedagogy in Accounting: Randomized Case Studies and Automated Assessment*.

The sales case supports analysis of monthly sales, prices, returns, and warranty claims using randomized Excel data.

## Browser practice site

[Open Accounting Case Lab](https://ais-2026-anonymous.github.io/scalable-accounting-analytics-sales-case/).

The static site grades saved Excel answers with Python running in the browser and offers optional, locally generated feedback from a case-fine-tuned Qwen3-4B model hosted on Hugging Face. Workbooks, explanations and results are not uploaded or recorded. See [WEB-APP.md](WEB-APP.md) for the grading contract, model training and limitations.

## Files

| File | Use |
| --- | --- |
| [SalesSimulationSpring2026.xlsm](SalesSimulationSpring2026.xlsm) | Macro-enabled generator for student working copies. Contains the data-generation formulas, the `Generate_Data` VBA procedure, and a response worksheet. |
| [SHA256SUMS.txt](SHA256SUMS.txt) | SHA-256 checksum of the published workbook. |
| [PUBLICATION-NOTES.md](PUBLICATION-NOTES.md) | Metadata changes, original and published hashes, and verification scope. |

## Student workflow

1. Download the generator and make a working copy. Use desktop Microsoft Excel with VBA macros permitted under your institution's settings.
2. Open the working copy and click **Generate Data** on **Title Page** once. The macro changes this working copy: it fixes the generated values, removes the setup sheets, and creates protected copies of the data worksheets.
3. Work with **Sales**, **Warranties & Returns**, and **Solution**. Enter the requested identifying information and responses in **Solution** according to your instructor's directions.
4. Save the working copy under a new `.xlsm` filename. The supplied macro does not automatically export or save a separate file. Follow your instructor's submission instructions.

Begin with a fresh copy of the generator when a new dataset is needed. The original **Generate Data** control and setup sheets are removed after generation.

## Instructor use

The generator initially contains **Title Page** and four hidden worksheets: **Solution**, **Sales**, **Warranties & Returns**, and **Reference**. **Reference** holds generation assumptions. The **Generate Data** button calls `Generate_Data` in VBA `Module1`; supporting procedures are in `Module2`. The source is available in the workbook's Visual Basic editor.

`Generate_Data` places a timestamp in **Solution!B4**, fixes the calculated data to values, deletes **Reference** and **Title Page**, and adds **Sales Locked** and **Warranties & Returns Locked**. These protected worksheets preserve copies of the generated data. Worksheet protection is not a substitute for assessment access controls.

The instructor workbook, recommended solutions, and grader materials are supplied separately as confidential teaching and submission materials. The instructor workbook contains **Solution**, **Sales**, and **Warranties & Returns**, with worked calculations and graphs. Its answers apply to the included sample data, not every independently generated dataset.

This repository contains the student generator, embedded VBA, browser Python grader and synthetic feedback-model training materials. Confidential instructor workbooks, answer keys and original batch-grading materials are supplied separately.

## Preservation and existing limitations

Publication copies remove only the creator and last-modifier document metadata for anonymous review. Workbook data, formulas, formatting, charts, protection settings, and VBA were preserved. Details and hashes are in [PUBLICATION-NOTES.md](PUBLICATION-NOTES.md).

VBA execution and recalculation in Excel were not part of publication verification. Instructors should test the supplied files in their intended classroom environment before assignment.

