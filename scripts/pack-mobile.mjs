import {readFile,writeFile} from 'node:fs/promises';

const docs = new URL('../docs/',import.meta.url);
const [index,css,js,license] = await Promise.all(
    ['index.html','site.css','app.js','LICENSE-THREE.txt'].map(name=>readFile(new URL(name,docs),'utf8'))
);
const mobile = index
    .replace('<html lang="ru"', '<html lang="ru" data-offline-copy="true"')
    .replace(/\s*<link rel="(?:manifest|apple-touch-icon)"[^>]*>/g,'')
    .replace('<link rel="stylesheet" href="site.css">',()=>'<style>\n'+css+'\n</style>')
    .replace(/\s*<script defer src="app\.js"><\/script>/,'')
    .replace('</body>',()=> '<!--\n'+license+'\n-->\n<script>\n'
        +js.replace(/<\/script/gi,'<\\/script')+'\n</script>\n</body>');
await writeFile(new URL('kerbukovo-mobile.html',docs),mobile,'utf8');
