"""Independent integration checks for the issued-cell-map Python adapter."""
import copy,datetime,importlib.util,json,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('instructor_case',ROOT/'dist/grader.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
config=json.loads((ROOT/'dist/grader-config.json').read_text())
g.base_config_json=json.dumps(config)
exec((ROOT/'dist/instructor/instructor-grader.py').read_text(),g.__dict__)

class InstructorTests(unittest.TestCase):
    def setUp(self):
        self.payload=json.loads((ROOT/'dist/assets/practice-case.json').read_text())
        solution=self.payload['sheets']['Solution']
        new={a:copy.deepcopy(c) for a,c in solution.items() if not a.startswith('B')}
        self.questions=[]
        for i,q in enumerate(config['ITEMS']):
            cell='B'+str(40+i*3);new[cell]=copy.deepcopy(solution[q['cell']]);self.questions.append({**q,'cell':cell})
        for a,v in [('B1','Morgan'),('B2','Alex'),('B3','DEMO300001'),('A4','Timestamp'),('B4',46000)]:new[a]={'v':v}
        self.payload['sheets']['Solution']=new
        self.payload['meta']={n:{'protected':True,'locked':{'B4':True},'merges':[]} for n in g.REQUIRED}
        self.receipt={'id':'TEST-V01','checksum':'a'*64,'questions':self.questions,'assignedId':''}
    def grade(self):
        with patch.object(g,'parse_xlsx',return_value=self.payload):return g.grade_instructor_submission(b'fixture','case.xlsm',self.receipt)
    def test_reordered_answer_map_reuses_the_existing_six_point_grading_result(self):
        r=self.grade();self.assertTrue(r['valid']);self.assertEqual(r['earned'],6);self.assertEqual(r['results'][0]['cell'],'B40')
    def test_blank_designated_box_is_not_replaced_by_an_answer_in_another_cell(self):
        self.payload['sheets']['Solution']['Z100']=self.payload['sheets']['Solution'].pop('B43');r=self.grade();self.assertTrue(r['valid']);self.assertEqual(r['earned'],5)
    def test_assigned_id_mismatch_rejects(self):
        self.receipt['assignedId']='OTHER';r=self.grade();self.assertFalse(r['valid']);self.assertIn('student ID',r['reason'])
    def test_future_or_formula_timestamp_rejects(self):
        self.payload['sheets']['Solution']['B4']={'v':999999};self.assertFalse(self.grade()['valid'])
        self.payload['sheets']['Solution']['B4']={'v':46000,'f':'NOW()'};self.assertFalse(self.grade()['valid'])
    def test_source_copy_is_required(self):
        self.payload['sheets'].pop('Sales Locked');self.assertFalse(self.grade()['valid'])
    def test_uncached_student_formula_remains_unavailable(self):
        self.payload['sheets']['Solution']['B43']={'f':'SUM(A1:A2)'};r=self.grade();self.assertTrue(r['valid']);self.assertEqual(r['unavailable'],1)

if __name__=='__main__':unittest.main()
