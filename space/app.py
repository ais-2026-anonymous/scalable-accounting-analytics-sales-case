"""Hosted feedback only. No workbook processing, scoring or result persistence."""
import json
import gradio as gr
import spaces
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from lmformatenforcer import JsonSchemaParser
from lmformatenforcer.integrations.transformers import build_transformers_prefix_allowed_tokens_fn

BASE='Qwen/Qwen3-4B'
BASE_REVISION='1cfa9a7208912126459214e8b04321603b3df60c'
ADAPTER='hunterng/CaseLab-Qwen3-4B-SFT-q4f16_1-MLC'
ADAPTER_REVISION='091044502ff2d6c32cf222ff9799eeb94155791a'

tokenizer=AutoTokenizer.from_pretrained(BASE,revision=BASE_REVISION)
base=AutoModelForCausalLM.from_pretrained(BASE,revision=BASE_REVISION,torch_dtype=torch.float16,low_cpu_mem_usage=True,attn_implementation='sdpa')
model=PeftModel.from_pretrained(base,ADAPTER,revision=ADAPTER_REVISION,is_trainable=False,torch_device='cpu').eval().to('cuda')

def validate_request(request_json):
    if not isinstance(request_json,dict) or len(json.dumps(request_json))>40000:
        raise gr.Error('Invalid feedback request.')
    messages=request_json.get('messages')
    if not isinstance(messages,list) or not 1<=len(messages)<=20:
        raise gr.Error('Invalid feedback messages.')
    if any(not isinstance(m,dict) or m.get('role') not in {'system','user','assistant'} or not isinstance(m.get('content'),str) or len(m['content'])>14000 for m in messages):
        raise gr.Error('Invalid feedback messages.')
    try:
        supplied=json.loads(request_json['response_format']['schema'])
        status=supplied['properties']['checked_status']['enum'][0]
        if status not in {'correct','incorrect','missing','unavailable'}:
            raise ValueError()
    except (KeyError,ValueError,TypeError,IndexError):
        raise gr.Error('Invalid checker status.') from None
    schema={'type':'object','properties':{'checked_status':{'type':'string','enum':[status]},**{k:{'type':'string'} for k in ['explanation','next_step','question']}},'required':['checked_status','explanation','next_step','question'],'additionalProperties':False}
    return messages,schema

@spaces.GPU(duration=35)
def feedback(request_json):
    messages,schema=validate_request(request_json)
    text=tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False)
    inputs=tokenizer(text,return_tensors='pt')
    if inputs['input_ids'].shape[1]>3400:
        raise gr.Error('Please shorten your explanation.')
    inputs={k:v.to(model.device) for k,v in inputs.items()}
    allowed=build_transformers_prefix_allowed_tokens_fn(tokenizer,JsonSchemaParser(schema))
    with torch.inference_mode():
        output=model.generate(**inputs,max_new_tokens=600,do_sample=False,prefix_allowed_tokens_fn=allowed,pad_token_id=tokenizer.eos_token_id)
    raw=tokenizer.decode(output[0,inputs['input_ids'].shape[1]:],skip_special_tokens=True).strip()
    try:
        value=json.loads(raw)
        if value.get('checked_status')!=schema['properties']['checked_status']['enum'][0]:
            raise ValueError()
    except (ValueError,TypeError):
        raise gr.Error('The model could not complete feedback. Try again.') from None
    return raw

with gr.Blocks(analytics_enabled=False,title='Autograder feedback') as demo:
    gr.Markdown('Autograder feedback service')
    request=gr.JSON(visible=False)
    response=gr.Textbox(visible=False)
    trigger=gr.Button(visible=False)
    trigger.click(feedback,inputs=request,outputs=response,api_name='feedback',concurrency_limit=1)

demo.queue(max_size=32).launch(show_error=False)
