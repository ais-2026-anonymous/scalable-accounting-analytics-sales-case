"""Instructor adapter to the existing Python grader; integrity is checked first in JS.

The ten numerical computations and mistake categories come from ../grader.py.
Only the issued question/cell map is substituted. No LLM assigns grades.
"""
def grade_instructor_submission(raw, name, receipt):
    try:
        payload = parse_xlsx(raw, name)
        sheets, meta = payload['sheets'], payload['meta']
        if 'Reference' in sheets or 'Title Page' in sheets:
            raise ValueError('Run Generate Data once in desktop Excel and save.')
        if set(REQUIRED) - set(sheets):
            raise ValueError('The required generated source copies are missing.')
        solution = sheets['Solution']
        for a in ['B1', 'B2', 'B3']:
            if empty(solution.get(a)) or solution.get(a, {}).get('f'):
                raise ValueError('Complete the name and student ID fields with fixed values.')
        if receipt.get('assignedId') and str(value(solution, 'B3')).strip() != receipt['assignedId']:
            raise ValueError('The student ID does not match the ID assigned to this version.')
        if str(value(solution, 'A4')).strip().lower() != 'timestamp':
            raise ValueError('The macro generation timestamp label is missing.')
        stamp = value(solution, 'B4')
        if solution.get('B4', {}).get('f') or not meta['Solution']['locked'].get('B4', True):
            raise ValueError('The generation timestamp must remain a frozen, locked value.')
        when = dt.datetime(1899, 12, 30) + dt.timedelta(days=stamp) if isinstance(stamp, (float, int)) else dt.datetime.fromisoformat(str(stamp))
        if when < dt.datetime(2000, 1, 1) or when.replace(tzinfo=None) > dt.datetime.now() + dt.timedelta(minutes=10):
            raise ValueError('The generation timestamp is invalid or in the future.')
        for n in ['Solution', 'Sales Locked', 'Warranties & Returns Locked']:
            if not meta[n]['protected']:
                raise ValueError('Required sheet protection is absent: ' + n)
        for q in receipt['questions']:
            if any(q['cell'] in merged.split(':') for merged in meta['Solution']['merges']):
                raise ValueError('An answer cell was merged or relocated.')
        config = json.loads(base_config_json)
        config['ITEMS'] = receipt['questions']
        configure(config)
        result = grade_payload(payload, 'concept', False)
        result['source'] = 'issued protected source copies'
        result['integrity'] = {'assignment': receipt['id'], 'checksum': receipt['checksum'], 'timestamp': 'present, frozen, plausible and locked'}
        result['warnings'] = [w for w in result['warnings'] if 'seed' not in w.lower()]
        return result
    except (ValueError, KeyError, TypeError, IndexError, OverflowError, ET.ParseError, zipfile.BadZipFile) as exc:
        return {'valid': False, 'earned': 0, 'possible': 10, 'reason': str(exc), 'results': []}
