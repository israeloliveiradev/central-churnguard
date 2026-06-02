const { execSync } = require('child_process');

function runBrowse(args) {
  try {
    const output = execSync(`browse ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return output;
  } catch (err) {
    return 'ERROR:\n' + err.stdout + '\n' + err.stderr;
  }
}

console.log('Opening browser...');
runBrowse('open http://localhost:5173 --local');
runBrowse('wait load');
runBrowse('wait timeout 2000');

console.log('Running click eval...');
const code = `const el = Array.from(document.querySelectorAll(".menu-btn")).find(e => e.textContent.includes("Base de Clientes")); if (el) { el.click(); 'clicked'; } else { 'not_found'; }`;
const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const raw = runBrowse(`eval "${escapedCode}"`);
console.log('Raw output:', raw);
