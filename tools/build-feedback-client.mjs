import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({stdin:{contents:'export {Client} from "@gradio/client";',resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/vendor/gradio.js',legalComments:'eof'});
await copyFile('node_modules/@gradio/client/LICENSE','dist/vendor/GRADIO-CLIENT-LICENSE.txt');
