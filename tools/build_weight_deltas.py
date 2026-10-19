"""Package exact byte deltas against pinned public MLC base tensors."""
from pathlib import Path
import json, urllib.request, hashlib, gzip, concurrent.futures, functools
import numpy as np

p = Path(__file__).resolve().parents[1]
work = p.parent
base = work / 'case-model-export-reference-4'
model = p / 'dist/models/resolve/caselab-qwen3-4'
base.mkdir(exist_ok=True)
revision = 'a5c9fab855e3ccbdfed2e7e69683d75f30332161'
url = f'https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/resolve/{revision}/'
original = json.loads(urllib.request.urlopen(url+'ndarray-cache.json').read())
trained = json.loads((model / 'tensor-cache.json').read_text())
parts = json.loads((model / 'weight-parts.json').read_text())

def download(shard):
    f = base / shard['dataPath']
    valid = f.exists() and f.stat().st_size == shard['nbytes'] and hashlib.md5(f.read_bytes()).hexdigest() == shard['md5sum']
    if not valid:
        for attempt in range(3):
            try:
                urllib.request.urlretrieve(url + f.name, f)
                break
            except Exception:
                if attempt == 2:
                    raise
    if f.stat().st_size != shard['nbytes'] or hashlib.md5(f.read_bytes()).hexdigest() != shard['md5sum']:
        raise ValueError('Base weight size mismatch')
    return f.name

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for i, name in enumerate(pool.map(download, original['records'])):
        print(f'Base tensor {i+1}/{len(original["records"])} ready', flush=True)

lookup = {}
for s in original['records']:
    digest = hashlib.sha256((base / s['dataPath']).read_bytes()).hexdigest()
    for r in s['records']:
        lookup[r['name']] = {**r, 'file': s['dataPath'], 'baseSha256': digest}

@functools.lru_cache(maxsize=4)
def raw(name):
    return (base / name).read_bytes()

manifest = {'baseUrl': url, 'baseRevision': revision, 'shards': {}}
total = 0
for i, s in enumerate(trained['records']):
    baseline = bytearray(s['nbytes'])
    sources = []
    for r in s['records']:
        b = lookup[r['name']]
        assert b['nbytes'] == r['nbytes']
        baseline[r['byteOffset']:r['byteOffset']+r['nbytes']] = raw(b['file'])[b['byteOffset']:b['byteOffset']+b['nbytes']]
        sources.append({'file': b['file'], 'offset': b['byteOffset'], 'target': r['byteOffset'], 'bytes': r['nbytes'], 'sha256': b['baseSha256']})
    target = b''.join((model / x).read_bytes() for x in parts[s['dataPath']])
    assert len(target) == len(baseline)
    delta = np.bitwise_xor(np.frombuffer(baseline, dtype=np.uint8), np.frombuffer(target, dtype=np.uint8)).tobytes()
    patch = gzip.compress(delta, compresslevel=6, mtime=0)
    names = []
    for start in range(0, len(patch), 20*1024*1024):
        name = s['dataPath'] + f'.delta{len(names)}'
        (model / name).write_bytes(patch[start:start+20*1024*1024])
        names.append(name)
    assert np.bitwise_xor(np.frombuffer(baseline, dtype=np.uint8), np.frombuffer(gzip.decompress(patch), dtype=np.uint8)).tobytes() == target
    manifest['shards'][s['dataPath']] = {'sources': sources, 'parts': names, 'bytes': len(target), 'sha256': hashlib.sha256(target).hexdigest()}
    total += len(patch)
    print(f'Exact delta {i+1}/{len(trained["records"])}: {len(patch)} bytes', flush=True)
(model / 'weight-deltas.json').write_text(json.dumps(manifest))
(p / 'training/delta-report.json').write_text(json.dumps({'baseRevision': revision, 'deltaBytes': total, 'exactReconstructionVerified': True, 'trainedBytes': sum(s['nbytes'] for s in trained['records'])}, indent=2))
print('DELTA_BYTES', total, flush=True)
