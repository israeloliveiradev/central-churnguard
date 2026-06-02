const { execSync } = require('child_process');

function runBrowse(args) {
  try {
    return execSync(`browse ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    return err.stdout + '\n' + err.stderr;
  }
}

console.log('Opening page and setting up logs...');
runBrowse('open http://localhost:5173 --local');
runBrowse('wait load');
runBrowse('wait timeout 2000');

// Inject console capture
runBrowse(`eval "window.__console_logs = []; const originalConsoleError = console.error; console.error = (...args) => { window.__console_logs.push('[CONSOLE_ERROR] ' + args.join(' ')); originalConsoleError.apply(console, args); }; window.addEventListener('error', e => window.__console_logs.push('[WINDOW_ERROR] ' + e.message + ' at ' + e.filename + ':' + e.lineno)); window.addEventListener('unhandledrejection', e => window.__console_logs.push('[UNHANDLED_REJECTION] ' + (e.reason?.message || e.reason))); 'injected'"` );

console.log('Clicking "Base de Clientes"...');
runBrowse(`eval "document.querySelectorAll('.menu-btn')[1].click(); 'clicked'"`);
runBrowse('wait timeout 1000');

console.log('Clicking "Chat Reativo"...');
runBrowse(`eval "document.querySelectorAll('.menu-btn')[2].click(); 'clicked'"`);
runBrowse('wait timeout 1000');

console.log('Clicking "Agentes e Logs"...');
runBrowse(`eval "document.querySelectorAll('.menu-btn')[3].click(); 'clicked'"`);
runBrowse('wait timeout 1000');

console.log('Reading logs...');
const logs = runBrowse('eval "window.__console_logs"');
console.log('--- CONSOLE LOGS ---');
console.log(logs);
console.log('--------------------');
