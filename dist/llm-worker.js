import {WebWorkerMLCEngineHandler} from './vendor/webllm.js?v=0.4.0';
const handler=new WebWorkerMLCEngineHandler();
self.onmessage=message=>handler.onmessage(message);
