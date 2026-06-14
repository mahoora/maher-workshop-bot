const fs = require('fs');
const path = require('path');
const utilsFile = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');
if (!fs.existsSync(utilsFile)) { console.log('Utils.js not found, skipping'); process.exit(0); }
let content = fs.readFileSync(utilsFile, 'utf8');
const find = 'window.require(\'WAWebStatusGatingUtils\').canCheckStatusRankingPosterGating()';
const replace = '(function(){try{return window.require(\'WAWebStatusGatingUtils\').canCheckStatusRankingPosterGating()}catch(e){return false}})()';
if (content.includes(find) && !content.includes(replace)) {
  content = content.replaceAll(find, replace);
  fs.writeFileSync(utilsFile, content, 'utf8');
  console.log('✅ Patched canCheckStatusRankingPosterGating');
} else if (content.includes(replace)) {
  console.log('Already patched');
} else {
  console.log('Pattern not found');
}
