"""Synthetic mistakes in an instructor fixture, labeled ONLY by Python grading."""
import copy,importlib.util,json
from pathlib import Path
p=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('casegrader',p/'dist/grader.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
g.configure(json.loads((p/'dist/grader-config.json').read_text(encoding='utf-8')))
data=json.loads((p/'tests/fixtures/instructor-case.json').read_text(encoding='utf-8'));m,o,c,_,_=g.extract(data['sheets']);cases=[]
def add(kind,cell,v):
 d=copy.deepcopy(data);d['sheets']['Solution'][cell]=v if isinstance(v,dict) else {'v':v}
 r=g.grade_payload(d);row=next(x for x in r['results'] if x['cell']==cell)
 cases.append({'kind':kind,'result':{'results':[row]},'cell':cell})
for cell,k,prod in [('B7','2012-02','A'),('B8','2019-12','B')]:
 r=m[k][prod];other='B' if prod=='A' else 'A'
 for kind,v in [('units_for_revenue',r['units']),('cross_year',sum(v[prod]['revenue'] for key,v in m.items() if key[5:]==k[5:])),('average_for_total',r['revenue']/m[k]['days']),('wrong_product',m[k][other]['revenue']),('wrong_period',m[g.shift(k,-1)][prod]['revenue']),('unknown',1.234567),('missing',None),('excel_error',{'t':'e','v':'#VALUE!'})]:add(kind,cell,v)
for cell,k,prod in [('B12','2012-02','A'),('B13','2019-12','B')]:
 add('inverted_price',cell,m[k][prod]['units']/m[k][prod]['revenue']);add('correct',cell,data['sheets']['Solution'][cell]);add('correct_bad_method',cell,data['sheets']['Solution'][cell])
for cell,k,prod,kind,lag in [('B19','2012-02','A','return',1),('B20','2019-12','B','return',1),('B24','2012-02','A','warranty',2),('B25','2019-12','B','warranty',2)]:
 r=m[k][prod];n=o[g.shift(k,lag)][prod][kind];correct=n/r['units']
 for mistake,v in [('same_month',o[k][prod][kind]/r['units']),('prior_cohort',o[k][prod][kind]/m[g.shift(k,-lag)][prod]['units']),('revenue_denominator',n/r['revenue']),('net_units',n/(r['units']-o[g.shift(k,1)][prod]['return'])),('count_for_rate',n),('percent_scale',correct*100),('correct',correct),('injection',o[k][prod][kind]/r['units'])]:add(mistake,cell,v)
 if kind=='warranty':add('one_month_warranty',cell,o[g.shift(k,1)][prod]['warranty']/r['units'])
for cell,prod in [('B14','A'),('B15','B')]:
 add('month_format',cell,c[prod][:3]);add('clearance',cell,'January' if c[prod]!='January' else 'February')
(p/'test-results/training-cases.json').write_text(json.dumps(cases),encoding='utf-8')
print(f'{len(cases)} Python-labeled synthetic case conditions.')
