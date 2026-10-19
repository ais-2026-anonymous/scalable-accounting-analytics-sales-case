"""Actual local supervised LoRA fine-tuning; no student records or remote API."""
import hashlib,json,os,random,time
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import Dataset
from transformers import AutoTokenizer,AutoModelForCausalLM,Trainer,TrainingArguments,BitsAndBytesConfig
from peft import LoraConfig,get_peft_model,prepare_model_for_kbit_training,PeftModel

project=Path(__file__).resolve().parents[1];work=project.parent
size=os.environ.get('CASELAB_MODEL_SIZE','4B');suffix={'0.6B':'','1.7B':'-1_7','4B':'-4'}[size];kbit=size!='0.6B';steps=60 if size=='4B' else 180;rank=8 if size=='4B' else 16
base=work/f'case-model-base{suffix}';output=work/f'case-model-adapter{suffix}';merged=work/f'case-model-merged{suffix}'
seed=20261018;random.seed(seed);np.random.seed(seed);torch.manual_seed(seed)
assert torch.cuda.is_available(),'Local CUDA training requires the detected GPU.'
tokenizer=AutoTokenizer.from_pretrained(base)
tokenizer.pad_token=tokenizer.eos_token;tokenizer.padding_side='right'
class Examples(Dataset):
 def __init__(self,path):
  self.items=[];self.max_length=0
  for line in path.read_text(encoding='utf-8').splitlines():
   msgs=json.loads(line)['messages']
   prompt=tokenizer.apply_chat_template(msgs[:-1],tokenize=True,add_generation_prompt=True,enable_thinking=False)
   full=tokenizer.apply_chat_template(msgs,tokenize=True,enable_thinking=False)
   self.max_length=max(self.max_length,len(full))
   assert len(full)<=1536, f'Training example too long: {len(full)}'
   self.items.append({'input_ids':full,'attention_mask':[1]*len(full),'labels':[-100]*len(prompt)+full[len(prompt):]})
 def __len__(self):return len(self.items)
 def __getitem__(self,i):return self.items[i]
def collate(rows):
 length=max(len(x['input_ids']) for x in rows)
 return {k:torch.tensor([r[k]+[(-100 if k=='labels' else tokenizer.pad_token_id if k=='input_ids' else 0)]*(length-len(r[k])) for r in rows]) for k in ['input_ids','attention_mask','labels']}
train=Examples(project/'training/train.jsonl');heldout=Examples(project/'training/heldout.jsonl')
print(json.dumps({'gpu':torch.cuda.get_device_name(0),'train':len(train),'heldout':len(heldout),'max_tokens':train.max_length}),flush=True)
model=AutoModelForCausalLM.from_pretrained(base,torch_dtype=torch.bfloat16,attn_implementation='sdpa',**({'quantization_config':BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.bfloat16,bnb_4bit_use_double_quant=True),'device_map':{'':0}} if kbit else {}))
if kbit:model=prepare_model_for_kbit_training(model,use_gradient_checkpointing=True)
model.config.use_cache=False
model=get_peft_model(model,LoraConfig(r=rank,lora_alpha=rank*2,lora_dropout=.05,bias='none',task_type='CAUSAL_LM',target_modules=['q_proj','k_proj','v_proj','o_proj','gate_proj','up_proj','down_proj']))
model.enable_input_require_grads();model.print_trainable_parameters()
args=TrainingArguments(output_dir=str(output),max_steps=steps,per_device_train_batch_size=1,gradient_accumulation_steps=2,per_device_eval_batch_size=1,learning_rate=5e-5 if size=='4B' else 2e-4,warmup_steps=5 if size=='4B' else 10,lr_scheduler_type='cosine',bf16=True,gradient_checkpointing=True,gradient_checkpointing_kwargs={'use_reentrant':False},logging_steps=10,save_strategy='no',eval_strategy='no',report_to=[],dataloader_num_workers=0,seed=seed,disable_tqdm=True)
trainer=Trainer(model=model,args=args,train_dataset=train,eval_dataset=heldout,data_collator=collate)
start=time.time();before=trainer.evaluate();print('BEFORE',before,flush=True)
trained=trainer.train();after=trainer.evaluate();trainer.save_model(str(output));tokenizer.save_pretrained(output)
print('AFTER',after,flush=True)
if kbit:
 del trainer,model;import gc;gc.collect();torch.cuda.empty_cache()
 full=AutoModelForCausalLM.from_pretrained(base,torch_dtype=torch.float16,device_map='cpu')
 model=PeftModel.from_pretrained(full,output)
model=model.merge_and_unload();model.config.use_cache=True;model.save_pretrained(merged,safe_serialization=True);tokenizer.save_pretrained(merged)
report={'base_model':f'Qwen/Qwen3-{size}','method':'Supervised QLoRA fine-tuning, merged into unquantized base weights' if kbit else 'Supervised LoRA fine-tuning, merged into base weights','seed':seed,'rank':rank,'steps':steps,'train_examples':len(train),'heldout_examples':len(heldout),'heldout_limitations':'Synthetic heldout wording variations from the same authored case families; not independent instructor or student feedback.','before':before,'after':after,'training':trained.metrics,'elapsed_seconds':time.time()-start,'gpu':torch.cuda.get_device_name(0),'data_sha256':{n:hashlib.sha256((project/f'training/{n}.jsonl').read_bytes()).hexdigest() for n in ['train','heldout']},'student_records_used':False,'instructor_approval_of_targets':False}
report.update(training_pool_examples=len(train),processed_example_exposures=steps*args.gradient_accumulation_steps*args.per_device_train_batch_size)
(project/f'training/training-report{suffix}.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
