import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({stdin:{contents:'export { CreateWebWorkerMLCEngine, WebWorkerMLCEngineHandler, prebuiltAppConfig } from "@mlc-ai/web-llm";',resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/vendor/webllm.js',legalComments:'eof'});
console.log('Bundled WebLLM 0.2.86 for local browser inference.');
