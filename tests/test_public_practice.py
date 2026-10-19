"""Portable checks using the public practice data and anonymous generator."""
import importlib.util,json,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('grader',ROOT/'dist/grader.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
g.configure(json.loads((ROOT/'dist/grader-config.json').read_text()))

class PublicPracticeTests(unittest.TestCase):
    def test_documented_practice_score(self):
        sample=json.loads((ROOT/'dist/assets/practice-case.json').read_text())
        result=g.grade_payload(sample)
        self.assertTrue(result['valid'])
        self.assertEqual(result['earned'],6)

    def test_disguised_excel_is_rejected(self):
        result=g.grade_bytes(b'<html>not an Excel workbook</html>','renamed.xlsx')
        self.assertFalse(result['valid'])
        self.assertEqual(result['earned'],0)

    def test_unsupported_format_is_rejected(self):
        result=g.grade_bytes(b'answer,10','submission.csv')
        self.assertFalse(result['valid'])
        self.assertEqual(result['earned'],0)

    def test_ungenerated_simulator_is_rejected(self):
        result=g.grade_bytes((ROOT/'SalesSimulationSpring2026.xlsm').read_bytes(),'case.xlsm')
        self.assertFalse(result['valid'])
        self.assertEqual(result['earned'],0)

if __name__=='__main__':unittest.main()
