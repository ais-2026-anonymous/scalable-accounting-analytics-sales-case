"""Use the identical browser Python grader locally without a server or log file."""
import argparse,importlib.util,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('casegrader',root/'dist/grader.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
g.configure(json.loads((root/'dist/grader-config.json').read_text(encoding='utf-8')))
parser=argparse.ArgumentParser();parser.add_argument('workbook',type=Path);parser.add_argument('--policy',choices=['concept','legacy'],default='concept');args=parser.parse_args()
if args.workbook.stat().st_size>20*1024*1024:result={'valid':False,'earned':0,'possible':10,'reason':'Workbook exceeds the 20 MB submission limit.'}
else:result=g.grade_bytes(args.workbook.read_bytes(),args.workbook.name,args.policy)
print(json.dumps(result,indent=2))
