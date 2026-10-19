"""Python port of the existing SalesSolution computations and scripts 6/8.

Runs unchanged in CPython tests and in Pyodide. Standard library only. No VBA,
formula evaluation, filesystem persistence, network, images, or LLM grading.
"""
import calendar, datetime as dt, hashlib, io, json, math, re, zipfile
from decimal import Decimal,ROUND_HALF_EVEN
import xml.etree.ElementTree as ET

CONFIG = json.loads(open('/grader-config.json',encoding='utf-8').read()) if __name__ == '__browser__' else None
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REQUIRED=['Solution','Sales','Sales Locked','Warranties & Returns','Warranties & Returns Locked']

def configure(config):
    global CONFIG
    CONFIG=config

def num(v):
    if isinstance(v,bool): return None
    if isinstance(v,(float,int)): return v if math.isfinite(v) else None
    if not isinstance(v,str) or not v.strip(): return None
    pct=v.strip().endswith('%');s=re.sub(r'[$,%\s]','',v.strip())
    if re.fullmatch(r'\([\d.]+\)',s):s='-'+s[1:-1]
    try:n=float(s);return n/(100 if pct else 1) if math.isfinite(n) else None
    except ValueError:return None

def key(v):
    if isinstance(v,(int,float)):return (dt.datetime(1899,12,30)+dt.timedelta(days=v)).strftime('%Y-%m')
    if not isinstance(v,str):raise ValueError('Invalid date in case sources.')
    for fmt in ['%Y-%m-%d','%Y-%m-%dT%H:%M:%S','%B %Y','%b %Y','%m/%d/%Y','%Y-%m']:
        try:return dt.datetime.strptime(v,fmt).strftime('%Y-%m')
        except ValueError:pass
    raise ValueError('Invalid date in case sources.')

def shift(k,n):
    y,m=map(int,k.split('-'));i=y*12+m-1+n;return f'{i//12:04d}-{i%12+1:02d}'
def ratio(a,b):return a/b if a is not None and b not in (0,None) else None
def near(a,b,t=1e-7):return a is not None and b is not None and abs(a-b)<=max(t,abs(b)*1e-9)
def value(s,a):return s.get(a,{}).get('v')
def empty(c):return not c or c.get('v') is None or c.get('v')==''

def parse_xlsx(raw,filename):
    ext=filename.lower().rsplit('.',1)[-1]
    if ext not in ('xlsx','xlsm'):raise ValueError('Only .xlsx and .xlsm submissions are accepted. Other file formats receive zero.')
    if len(raw)>20*1024*1024:raise ValueError('Workbook exceeds the 20 MB submission limit.')
    if raw[:4]!=b'PK\x03\x04':raise ValueError('File content is not an Excel OOXML workbook; renaming a file does not make it valid.')
    try:z=zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:raise ValueError('Invalid workbook ZIP container.')
    entries=z.infolist();names=set(z.namelist())
    if len(entries)>4000 or sum(i.file_size for i in entries)>100*1024*1024 or any(i.flag_bits&1 for i in entries):raise ValueError('Workbook is encrypted or exceeds safe extraction limits.')
    if not {'[Content_Types].xml','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml'}<=names:raise ValueError('Required OOXML workbook parts are absent.')
    types=z.read('[Content_Types].xml').decode('utf-8')
    want='application/vnd.ms-excel.sheet.macroEnabled.main+xml' if ext=='xlsm' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
    if want not in types:raise ValueError('File extension does not match the actual workbook type.')
    if any(n.startswith('xl/externalLinks/') for n in names):raise ValueError('External workbook links are not accepted; submit a self-contained case workbook.')
    strings=[]
    if 'xl/sharedStrings.xml' in names:
        strings=[''.join(s.itertext()) for s in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS)]
    styles=ET.fromstring(z.read('xl/styles.xml'));formats={int(x.attrib['numFmtId']):x.attrib['formatCode'] for x in styles.findall('m:numFmts/m:numFmt',NS)}
    xfs=styles.findall('m:cellXfs/m:xf',NS)
    book=ET.fromstring(z.read('xl/workbook.xml'));props=book.find('m:workbookPr',NS)
    date1904=props is not None and props.attrib.get('date1904') in ('1','true')
    rels={x.attrib['Id']:x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets={};meta={}
    for sh in book.findall('m:sheets/m:sheet',NS):
        name=sh.attrib['name'];rid=sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'];path=rels[rid]
        path=path.lstrip('/') if path.startswith('/') else 'xl/'+path
        if '..' in path.split('/'):raise ValueError('Invalid workbook relationship path.')
        xml=ET.fromstring(z.read(path));s={};protection=xml.find('m:sheetProtection',NS)
        meta[name]={'protected':protection is not None and protection.attrib.get('sheet') in ('1','true'),'locked':{},'merges':[x.attrib['ref'] for x in xml.findall('m:mergeCells/m:mergeCell',NS)]}
        for c in xml.findall('m:sheetData/m:row/m:c',NS):
            a=c.attrib['r'];t=c.attrib.get('t','n');si=int(c.attrib.get('s',0));v=c.find('m:v',NS);f=c.find('m:f',NS)
            item={'t':t};text=v.text if v is not None else None
            if t=='s' and text is not None:item['v']=strings[int(text)]
            elif t=='inlineStr':
                inline=c.find('m:is',NS);item['v']=''.join(inline.itertext()) if inline is not None else None
            elif t in ('str','e','d'):item['v']=text
            elif text is not None:
                try:item['v']=float(text)
                except ValueError:item['v']=text
            if name=='Solution' and a=='B4' and date1904 and isinstance(item.get('v'),(int,float)):
                item['v']=(dt.datetime(1904,1,1)+dt.timedelta(days=item['v'])).isoformat()
            if f is not None:item['f']=f.text or '(formula)'
            xf=xfs[si] if si<len(xfs) else None
            fmtid=int(xf.attrib.get('numFmtId',0)) if xf is not None else 0
            fmt=formats.get(fmtid,'0.00%' if fmtid in (9,10) else '')
            lock=xf.find('m:protection',NS) if xf is not None else None
            meta[name]['locked'][a]=lock is None or lock.attrib.get('locked','1') not in ('0','false')
            if '%' in fmt and isinstance(item.get('v'),(int,float)):
                decimal=re.search(r'0\.(0+)',fmt);places=len(decimal[1]) if decimal else 0;item['w']=f'{item["v"]*100:.{places}f}%'
            if (name.startswith('Sales') or name.startswith('Warranties & Returns')) and a.startswith('A') and int(a[1:])>=6 and isinstance(item.get('v'),(int,float)):
                item['v']=(dt.datetime(1904,1,1) if date1904 else dt.datetime(1899,12,30))+dt.timedelta(days=item['v']);item['v']=item['v'].isoformat()[:10]
            s[a]=item
        sheets[name]=s
    return {'sheets':sheets,'meta':meta}

def validate_submission(payload):
    sheets,meta=payload['sheets'],payload.get('meta',{})
    if set(REQUIRED)-set(sheets):raise ValueError('Required generated case sheets are missing. Both protected source copies must be present.')
    if 'Reference' in sheets or 'Title Page' in sheets:raise ValueError('This is the ungenerated simulation workbook. Run Generate Data in Excel before submitting.')
    solution=sheets['Solution']
    for a in ['B1','B2','B3']:
        if empty(solution.get(a)) or not str(value(solution,a)).strip() or len(str(value(solution,a)).strip())>120:raise ValueError('Required name and student identifier fields in Solution!B1:B3 must be completed.')
    stamp=value(solution,'B4')
    if solution.get('B4',{}).get('f'):raise ValueError('The generation timestamp must be a frozen value, not a recalculating formula.')
    try:
        when=dt.datetime(1899,12,30)+dt.timedelta(days=stamp) if isinstance(stamp,(int,float)) else dt.datetime.fromisoformat(str(stamp))
        when=when.replace(tzinfo=None)
        if when<dt.datetime(2000,1,1) or when>dt.datetime.now()+dt.timedelta(minutes=10):raise ValueError()
    except (ValueError,TypeError,OverflowError):raise ValueError('Solution!B4 must contain a valid generation timestamp that is not in the future.')
    if str(value(solution,'A4')).strip().lower()!='timestamp':raise ValueError('The original timestamp label at Solution!A4 is missing.')
    for name in ['Solution','Sales Locked','Warranties & Returns Locked']:
        if not meta.get(name,{}).get('protected'):raise ValueError(f'{name} is no longer protected as required by the case macro.')
    if not meta['Solution'].get('locked',{}).get('B4',True):raise ValueError('The generation timestamp cell must remain locked.')
    for name,end in [('Sales Locked',3658),('Warranties & Returns Locked',125)]:
        required={'B4':'A','D4':'B',**({'A4':'Date','B5':'Units Sold','C5':'Total Sales','D5':'Units Sold','E5':'Total Sales'} if name=='Sales Locked' else {'B5':'Return','C5':'Warranty','D5':'Return','E5':'Warranty'})}
        for cell,label in required.items():
            if str(value(sheets[name],cell)).strip().lower()!=label.lower():raise ValueError(f'The original source-column layout has changed in {name}!{cell}.')
        for a in sheets[name]:
            if re.fullmatch(r'[A-E]\d+',a) and int(a[1:])>end and not empty(sheets[name][a]):raise ValueError('Unexpected extra data rows in protected original sources.')
            if re.fullmatch(r'[A-E]\d+',a) and int(a[1:])<=end and not meta[name]['locked'].get(a,True):raise ValueError('Original source cells must remain locked.')
    for item in CONFIG['ITEMS']:
        a=item['cell'];label=str(value(solution,'A'+a[1:]) or '').lower()
        if 'product '+item['product'].lower() not in label:raise ValueError(f'The required answer box layout has changed at {a}.')
        if item['period']:
            y,m=map(int,item['period'].split('-'))
            if f'{calendar.month_name[m]} {y}'.lower() not in label:raise ValueError(f'The required question period has changed at {a}.')
        if item['kind']=='month' and not any(x in label for x in ['discount','clearance']):raise ValueError(f'The clearance question layout has changed at {a}.')
        if any(a in rng.split(':') for rng in meta['Solution'].get('merges',[])):raise ValueError(f'Answer box {a} must not be merged or relocated.')
    # The supplied macro has no seed field. A content fingerprint is an identifier,
    # never mislabeled as proof of a reproducible seed or authenticated origin.
    return {'timestamp':'present, plausible, locked','seed':'not recorded by the supplied case macro','sourceProtection':'present','originAuthentication':'not available for legacy workbooks','duplicateCheck':'requires trusted cohort records; not performed by this no-storage tool'}

def extract(sheets):
    if not all(n in sheets for n in ['Solution','Sales','Warranties & Returns']):raise ValueError('Wrong case: required sales worksheets are absent.')
    if 'Reference' in sheets or 'Title Page' in sheets:raise ValueError('Ungenerated simulation workbook.')
    locked='Sales Locked' in sheets and 'Warranties & Returns Locked' in sheets
    sales=sheets['Sales Locked' if locked else 'Sales'];claims=sheets['Warranties & Returns Locked' if locked else 'Warranties & Returns']
    monthly={};observed={};seen=set();warnings=[]
    for r in range(6,3659):
        day=value(sales,f'A{r}');k=key(day)
        if not re.fullmatch(r'201[1-9]-\d\d|2020-\d\d',k):raise ValueError('Source dates are outside the assigned period.')
        if day in seen:raise ValueError('Duplicate daily source date.')
        seen.add(day);rec=monthly.setdefault(k,{'days':0,'A':{'units':0,'revenue':0},'B':{'units':0,'revenue':0}});rec['days']+=1
        for p,cols in [('A',('B','C')),('B',('D','E'))]:
            for kind,col in zip(('units','revenue'),cols):
                c=sales.get(f'{col}{r}',{});n=num(c.get('v'))
                if c.get('f') or n is None or n<0:raise ValueError('Source data are incomplete, invalid, or still contain generator formulas.')
                rec[p][kind]+=n
    keys=sorted(monthly)
    if keys!=[shift('2011-01',i) for i in range(120)]:raise ValueError('Source months are incomplete.')
    for k in keys:
        y,m=map(int,k.split('-'))
        if monthly[k]['days']!=calendar.monthrange(y,m)[1]:raise ValueError('Daily source coverage is incomplete.')
    for i,r in enumerate(range(6,126)):
        k=key(value(claims,f'A{r}'))
        if k!=keys[i]:raise ValueError('Claim months are missing, shifted, or duplicated.')
        observed[k]={'A':{},'B':{}}
        for p,cols in [('A',('B','C')),('B',('D','E'))]:
            for kind,col in zip(('return','warranty'),cols):
                c=claims.get(f'{col}{r}',{});n=num(c.get('v'))
                if c.get('f') or (not empty(c) and (n is None or n<0)) or (i>=(1 if kind=='return' else 2) and n is None):raise ValueError('Claim observations are missing or invalid; only initial policy-lag blanks are allowed.')
                observed[k][p][kind]=n
    clearance={}
    for p in ['A','B']:
        prices=[ratio(monthly[k][p]['revenue'],monthly[k][p]['units']) for k in keys]
        if None in prices:raise ValueError('Zero monthly units prevent a defined rate.')
        avg=sum(prices)/len(prices);candidates={int(k[5:]) for k,v in zip(keys,prices) if v<avg-1e-8}
        if len(candidates)!=1:raise ValueError('A unique recurring clearance month could not be identified.')
        clearance[p]=CONFIG['MONTHS'][candidates.pop()-1]
    mismatch=0
    if locked:
        for name,end in [('Sales',3658),('Warranties & Returns',125)]:
            for r in range(6,end+1):
                for col in 'ABCDE':
                    if value(sheets[name],f'{col}{r}')!=value(sheets[name+' Locked'],f'{col}{r}'):mismatch+=1
    if mismatch:warnings.append(f'{mismatch} source cells differ from protected copies. Grading uses protected originals.')
    fingerprint=hashlib.sha256(json.dumps({'sales':[[value(sales,f'{col}{r}') for col in 'ABCDE'] for r in range(6,3659)],'claims':[[value(claims,f'{col}{r}') for col in 'ABCDE'] for r in range(6,126)]},sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return monthly,observed,clearance,warnings,fingerprint

def legacy(c):
    if empty(c):return None
    v=c.get('w',c.get('v'));n=num(v)
    return float(Decimal(str(n*(100 if isinstance(v,str) and '%' in v else 1))).quantize(Decimal('0.1'),rounding=ROUND_HALF_EVEN)) if n is not None else str(v).strip().lower()

def grade_payload(payload,mode='concept',strict=False):
    integrity=validate_submission(payload) if strict else {'demonstration':'Synthetic practice sample; not a validated student submission.'}
    sheets=payload['sheets'];monthly,obs,clearance,warnings,fingerprint=extract(sheets)
    taxonomy={x['id']:x for x in CONFIG['TAXONOMY']};results=[]
    for item in CONFIG['ITEMS']:
        p,k,kind=item['product'],item['period'],item['kind'];other='B' if p=='A' else 'A';rec=monthly.get(k,{}).get(p,{})
        lag=1 if kind=='return' else 2
        expected=clearance[p] if kind=='month' else rec['revenue'] if kind=='revenue' else ratio(rec['revenue'],rec['units']) if kind=='price' else ratio(obs[shift(k,lag)][p][kind],rec['units'])
        c=sheets['Solution'].get(item['cell'],{});n=num(c.get('v'));status='incorrect';ids=[];rate=kind in ('return','warranty');tol=.00005 if rate else .05
        if c.get('t')=='e':ids=['excel_error']
        elif c.get('f') and empty(c):status='unavailable';ids=['uncached']
        elif empty(c):status='missing';ids=['missing']
        else:
            passed=str(c.get('v')).strip().lower()==str(expected).lower() if kind=='month' else near(n,expected,tol)
            if mode=='legacy':passed=legacy(c)==legacy({'v':expected,'w':f'{expected*100:.2f}%' if rate else str(expected)})
            if passed:status='correct'
            elif kind=='month':ids=['month_format' if str(c.get('v')).strip().lower()==expected[:3].lower() or n==CONFIG['MONTHS'].index(expected)+1 else 'clearance']
            elif n is not None:
                candidates=[]
                if rate and expected!=0 and (near(n,expected*100,.005) or near(n,expected/100,.0000005)):ids.append('percent_scale')
                if kind=='revenue':candidates=[('units_for_revenue',rec['units']),('average_for_total',rec['revenue']/monthly[k]['days']),('wrong_product',monthly[k][other]['revenue']),('cross_year',sum(v[p]['revenue'] for month,v in monthly.items() if month[5:]==k[5:]))]+[('wrong_period',monthly.get(shift(k,j),{}).get(p,{}).get('revenue')) for j in (-1,1)]
                elif kind=='price':candidates=[('inverted_price',ratio(rec['units'],rec['revenue'])),('wrong_product',ratio(monthly[k][other]['revenue'],monthly[k][other]['units']))]
                elif rate:
                    count=obs[shift(k,lag)][p][kind];today=obs[k][p][kind]
                    candidates=[('same_month',ratio(today,rec['units'])),('prior_cohort',ratio(today,monthly.get(shift(k,-lag),{}).get(p,{}).get('units'))),('revenue_denominator',ratio(count,rec['revenue'])),('count_for_rate',count),('wrong_product',ratio(obs[shift(k,lag)][other][kind],monthly[k][other]['units'])),('net_units',ratio(count,rec['units']-obs[shift(k,1)][p]['return']))]
                    if kind=='warranty':candidates.append(('one_month_warranty',ratio(obs[shift(k,1)][p][kind],rec['units'])))
                ids.extend(i for i,v in candidates if near(n,v,tol) and i not in ids)
            if status=='incorrect' and not ids:ids=['unknown']
        mistakes=[taxonomy[i] for i in ids];message='Saved output matches the selected Python check; a matching value alone does not establish the method.' if status=='correct' else mistakes[0]['hint']
        results.append({**item,'status':status,'earned':int(status=='correct'),'actual':c.get('v'),'formulaPresent':bool(c.get('f')),'mistakes':mistakes,'message':message})
    unavailable=sum(r['status']=='unavailable' for r in results)
    return {'version':'0.3.0','engine':'Python / Pyodide','valid':True,'mode':mode,'earned':sum(r['earned'] for r in results),'possible':10,'assessed':10-unavailable,'unavailable':unavailable,'results':results,'warnings':warnings,'source':'protected copies' if strict else 'demonstration data','dailyCount':3653,'months':120,'integrity':integrity,'datasetFingerprint':fingerprint,'groups':[{**g,'earned':sum(r['earned'] for r in results if r['group']==g['id'])} for g in CONFIG['RUBRIC']]}

def grade_bytes(raw,filename,mode='concept'):
    try:return grade_payload(parse_xlsx(bytes(raw),filename),mode,True)
    except (ValueError,KeyError,TypeError,IndexError,ET.ParseError,zipfile.BadZipFile,OverflowError,RuntimeError,NotImplementedError,UnicodeError,EOFError,OSError) as e:return {'valid':False,'engine':'Python / Pyodide','earned':0,'possible':10,'reason':str(e),'results':[]}
