"""Export the merged Qwen3 fine-tune to the existing MLC q4f16_1 layout.

Uses the public MLC tensor manifest as a shape contract, symmetric group-32
int4 quantization, fp16 scales, and little-endian nibble packing. This avoids
the incompatible Windows TVM compiler wheel. It does not compile a new model
architecture: the official Qwen3-0.6B WebGPU library is reused unchanged.
"""
import argparse,hashlib,json,math,shutil,urllib.request,os
from pathlib import Path
import numpy as np
import torch
from safetensors.torch import load_file
from safetensors import safe_open

p=Path(__file__).resolve().parents[1];work=p.parent
size=os.environ.get('CASELAB_MODEL_SIZE','4B');suffix={'0.6B':'','1.7B':'-1_7','4B':'-4'}[size]
reference_dir=work/f'case-model-export-reference{suffix}';reference_dir.mkdir(exist_ok=True)
url=f'https://huggingface.co/mlc-ai/Qwen3-{size}-q4f16_1-MLC/resolve/main/'
def download(name):
 path=reference_dir/name
 if not path.exists():path.write_bytes(urllib.request.urlopen(url+name).read())
 return path
manifest=json.loads(download('ndarray-cache.json').read_text(encoding='utf-8'))
records=[r for shard in manifest['records'] for r in shard['records']]

def quantize(w):
 if w.shape[0]>4096:
  results=[quantize(part) for part in w.split(2048,dim=0)]
  return np.concatenate([x[0] for x in results]),np.concatenate([x[1] for x in results])
 w=w.to(torch.float16).cpu().contiguous();shape=w.shape;assert len(shape)==2 and shape[1]%32==0
 grouped=w.reshape(shape[0],-1,32);scale=(grouped.abs().amax(-1)/7).to(torch.float16)
 scale=torch.where(scale==0,torch.ones_like(scale),scale)
 q=torch.floor((grouped/scale.unsqueeze(-1)+7).to(torch.float16).float()+.5).clamp(0,14).to(torch.int64).reshape(shape[0],-1,8)
 shifts=torch.arange(8,dtype=torch.int64)*4
 packed=torch.sum(torch.bitwise_left_shift(q,shifts),-1).numpy().astype('<u4')
 return packed,scale.numpy().astype('<f2')

def load(path):
 weights={}
 for file in path.glob('*.safetensors'):weights.update(load_file(str(file)))
 return weights

def mapped(weights,name):
 if '.c_attn.weight' in name:
  return torch.cat([weights[name.replace('c_attn',x)] for x in ['q_proj','k_proj','v_proj']],dim=0)
 if '.gate_up_proj.weight' in name:
  return torch.cat([weights[name.replace('gate_up_proj',x)] for x in ['gate_proj','up_proj']],dim=0)
 return weights[name]

def verify_base():
 # Independent compatibility check against the publisher's actual packed bytes.
 w=load(work/f'case-model-base{suffix}')['model.embed_tokens.weight'][:128]
 packed,scale=quantize(w)
 shard=download(manifest['records'][0]['dataPath'])
 with shard.open('rb') as f:reference=np.frombuffer(f.read(packed.nbytes),dtype='<u4').reshape(packed.shape)
 fraction=float(np.mean(reference==packed))
 actual=np.stack([(packed>>(4*i))&15 for i in range(8)],-1).astype(np.int16)
 original=np.stack([(reference>>(4*i))&15 for i in range(8)],-1).astype(np.int16)
 nibble_agreement=float(np.mean(actual==original));max_difference=int(np.max(np.abs(actual-original)))
 print(json.dumps({'packed_word_agreement':fraction,'int4_value_agreement':nibble_agreement,'maximum_int4_difference':max_difference}),flush=True)
 # Half-precision rounding can differ by one quantization level across backends.
 assert nibble_agreement>.998 and max_difference<=1,'Packed format compatibility check failed.'
 return {'packed_word_agreement':fraction,'int4_value_agreement':nibble_agreement,'maximum_int4_difference':max_difference}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
 torch.set_num_threads(4);agreement=verify_base()
 if args.verify_only:raise SystemExit()
 weights=load(work/f'case-model-merged{suffix}');out=p/f'dist/models/resolve/caselab-qwen3{suffix}';out.mkdir(parents=True,exist_ok=True)
 probe='model.layers.0.self_attn.q_proj.weight';original=None
 for file in (work/f'case-model-base{suffix}').glob('*.safetensors'):
  with safe_open(file,framework='pt') as f:
   if probe in f.keys():original=f.get_tensor(probe).to(torch.float16);break
 assert original is not None
 change=float((weights[probe].float()-original.float()).abs().mean());assert change>0,'The merged model contains no trained update in the probe layer.'
 base_q,_=quantize(original);trained_q,_=quantize(weights[probe]);quantized_change=float(np.mean(base_q!=trained_q));assert quantized_change>0
 del original,base_q,trained_q
 output=[];chunks={};shard_data=bytearray();shard_records=[];chunk_limit=20*1024*1024;shard_limit=24*1024*1024
 def flush():
  global shard_data,shard_records
  if not shard_records:return
  name=f'params_{len(output)}.bin';parts=[]
  for start in range(0,len(shard_data),chunk_limit):
   part=f'{name}.part{len(parts)}';(out/part).write_bytes(shard_data[start:start+chunk_limit]);parts.append(part)
  chunks[name]=parts
  output.append({'dataPath':name,'format':'raw-shard','nbytes':len(shard_data),'records':shard_records,'md5sum':hashlib.md5(shard_data).hexdigest()})
  shard_data=bytearray();shard_records=[]
 cache={}
 for i,record in enumerate(records):
  name=record['name']
  if name.endswith('.q_weight') or name.endswith('.q_scale'):
   base=name.rsplit('.',1)[0]+'.weight'
   if base not in cache:cache[base]=quantize(mapped(weights,base))
   arr=cache[base][0 if name.endswith('q_weight') else 1]
   if name.endswith('q_scale'):del cache[base]
  else:arr=mapped(weights,name).to(torch.float16).numpy().astype('<f2')
  assert list(arr.shape)==record['shape'],(name,arr.shape,record['shape'])
  raw=arr.tobytes();assert len(raw)==record['nbytes']
  if shard_records and len(shard_data)+len(raw)>shard_limit:flush()
  shard_records.append({**record,'format':'raw','byteOffset':len(shard_data)});shard_data.extend(raw)
  if i%30==0:print(f'Exported {i+1}/{len(records)} tensors',flush=True)
 flush()
 (out/'ndarray-cache.json').write_text(json.dumps({'metadata':manifest['metadata'],'records':output},indent=2),encoding='utf-8')
 (out/'tensor-cache.json').write_text((out/'ndarray-cache.json').read_text(encoding='utf-8'),encoding='utf-8')
 (out/'weight-parts.json').write_text(json.dumps(chunks),encoding='utf-8')
 config=json.loads(download('mlc-chat-config.json').read_text(encoding='utf-8'));config['temperature']=.2
 (out/'mlc-chat-config.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
 for filename in config['tokenizer_files']:
  source=work/f'case-model-merged{suffix}'/filename
  if source.exists():shutil.copy2(source,out/filename)
  else:(out/filename).write_bytes(urllib.request.urlopen(url+filename).read())
 shutil.copy2(work/f'case-model-base{suffix}'/'LICENSE',out/'LICENSE')
 report={'base_compatibility':agreement,'parameters':len(records),'bytes':sum(x['nbytes'] for x in output),'shard_parts':sum(len(x) for x in chunks.values()),'maximum_part_bytes':chunk_limit,'dtype':'q4f16_1','trained_weights':True,'probe_mean_abs_weight_update':change,'probe_quantized_words_changed_fraction':quantized_change}
 (p/f'training/export-report{suffix}.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
