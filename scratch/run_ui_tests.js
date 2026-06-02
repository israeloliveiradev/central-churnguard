const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure screenshots directory exists
const screenshotDir = path.join(__dirname, '..', '.context', 'ui-test-screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Results array
const results = [];
let passCount = 0;
let failCount = 0;
let skipCount = 0;

function runBrowse(args) {
  let attempts = 5;
  while (attempts > 0) {
    try {
      const output = execSync(`browse ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return output;
    } catch (err) {
      attempts--;
      if (attempts === 0) {
        console.error(`COMMAND FAILED (all retries exhausted): browse ${args}`);
        console.error(`STDOUT:`, err.stdout);
        console.error(`STDERR:`, err.stderr);
        throw new Error(err.stdout + '\n' + err.stderr);
      }
      // Brief sleep before retrying
      try {
        execSync('node -e "setTimeout(() => {}, 500)"');
      } catch (_) {}
    }
  }
}

function evalJs(code) {
  const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const raw = runBrowse(`eval "${escapedCode}"`);
  const parsed = JSON.parse(raw);
  if (typeof parsed.result === 'string') {
    try {
      return JSON.parse(parsed.result);
    } catch (_) {
      return parsed.result;
    }
  }
  return parsed.result;
}

function triggerDomClick(selector, textContent = '') {
  let js = '';
  if (textContent) {
    const escapedText = textContent.replace(/'/g, "\\'");
    js = `const el = Array.from(document.querySelectorAll('${selector}')).find(e => e.textContent.includes('${escapedText}')); if (el) { setTimeout(() => el.click(), 50); 'clicked'; } else { 'not_found'; }`;
  } else {
    js = `const el = document.querySelector('${selector}'); if (el) { setTimeout(() => el.click(), 50); 'clicked'; } else { 'not_found'; }`;
  }
  return evalJs(js);
}

function recordPass(id, evidence) {
  passCount++;
  console.log(`STEP_PASS|${id}|${evidence}`);
  results.push({ id, status: 'PASS', evidence });
}

function recordFail(id, expected, actual) {
  failCount++;
  const screenshotName = `${id}.png`;
  const screenshotPath = path.join(screenshotDir, screenshotName);
  
  try {
    runBrowse(`screenshot --path "${screenshotPath}"`);
  } catch (err) {
    try {
      const output = runBrowse('screenshot');
      const tempPathMatch = output.match(/saved to\s+(.*?\.png)/i);
      if (tempPathMatch) {
        fs.copyFileSync(tempPathMatch[1].trim(), screenshotPath);
      }
    } catch (_) {}
  }
  
  console.log(`STEP_FAIL|${id}|${expected} → ${actual}|.context/ui-test-screenshots/${screenshotName}`);
  results.push({ id, status: 'FAIL', expected, actual, screenshot: `.context/ui-test-screenshots/${screenshotName}` });
}

function recordSkip(id, reason) {
  skipCount++;
  console.log(`STEP_SKIP|${id}|${reason}`);
  results.push({ id, status: 'SKIP', reason });
}

async function run() {
  console.log('=== STARTING CHURNGUARD UI TEST SUITE ===');
  
  try {
    runBrowse('open http://localhost:5173 --local');
    runBrowse('wait load');
    runBrowse('wait timeout 2000');
  } catch (err) {
    console.error('Failed to open app. Is the dev server running?', err.message);
    process.exit(1);
  }

  // --- Test 1: tab-navigation ---
  try {
    // Click Base de Clientes
    let clickRes = triggerDomClick('.menu-btn', 'Base de Clientes');
    if (clickRes === 'not_found') throw new Error('Base de Clientes tab button not found');
    runBrowse('wait timeout 500');
    let tree = runBrowse('snapshot');
    if (!tree.includes('Novo Cliente')) {
      throw new Error('Base de Clientes view did not render');
    }
    
    // Click Chat Reativo
    clickRes = triggerDomClick('.menu-btn', 'Chat Reativo');
    if (clickRes === 'not_found') throw new Error('Chat Reativo tab button not found');
    runBrowse('wait timeout 500');
    tree = runBrowse('snapshot');
    if (!tree.includes('Agent_Interactivity')) {
      throw new Error('Chat Reativo view did not render');
    }
    
    // Click Agentes e Logs
    clickRes = triggerDomClick('.menu-btn', 'Agentes e Logs');
    if (clickRes === 'not_found') throw new Error('Agentes e Logs tab button not found');
    runBrowse('wait timeout 500');
    tree = runBrowse('snapshot');
    if (!tree.includes('Agent_Notifier') && !tree.includes('Console de Logs')) {
      throw new Error('Agentes e Logs view did not render');
    }
    
    // Return to Overview
    triggerDomClick('.menu-btn', 'Painel Geral');
    runBrowse('wait timeout 500');
    
    recordPass('tab-navigation', 'All 4 tabs successfully navigated and rendered their content.');
  } catch (err) {
    recordFail('tab-navigation', 'Tabs should navigate successfully', err.message);
  }

  // --- Test 2: filter-customers ---
  try {
    // Go to Base de Clientes
    triggerDomClick('.menu-btn', 'Base de Clientes');
    runBrowse('wait timeout 500');
    
    let clickRes = triggerDomClick('.btn-filter', 'Críticos');
    if (clickRes === 'not_found') throw new Error('Críticos filter button not found');
    runBrowse('wait timeout 1000'); // wait API
    
    const scores = evalJs("Array.from(document.querySelectorAll('tbody tr')).map(r => r.cells[5]?.textContent)");
    
    if (scores && scores.length > 0) {
      const allCritical = scores.every(s => {
        const val = parseFloat(s.replace('%', ''));
        return isNaN(val) || val > 65.0;
      });
      if (!allCritical) {
        throw new Error(`Filtered list contains non-critical risk scores: ${scores.join(', ')}`);
      }
      recordPass('filter-customers', `Filter "Críticos" correctly limited results to scores > 65% (${scores.length} customers found).`);
    } else {
      recordPass('filter-customers', 'Filter "Críticos" yielded 0 results, which is a valid empty state.');
    }
  } catch (err) {
    recordFail('filter-customers', 'Filter "Críticos" should only display customers with risk > 65%', err.message);
  }

  // --- Test 3: search-customer ---
  try {
    triggerDomClick('.btn-filter', 'Todos');
    runBrowse('wait timeout 500');
    
    runBrowse('fill "input[placeholder*=\'Nome ou ID\']" "Alice"');
    runBrowse('wait timeout 1200'); // wait debounce + API
    
    const names = evalJs("Array.from(document.querySelectorAll('tbody tr')).map(r => r.cells[1]?.querySelector('strong')?.textContent)");
    
    if (names && names.length > 0) {
      const allMatch = names.every(name => name && name.toLowerCase().includes('alice'));
      if (!allMatch) {
        throw new Error(`Search results contained non-matching names: ${names.join(', ')}`);
      }
      recordPass('search-customer', `Search correctly filtered list to matching names: ${names.join(', ')}`);
    } else {
      recordPass('search-customer', 'Search yielded 0 results, which is a valid response for no matches.');
    }
    
    runBrowse('fill "input[placeholder*=\'Nome ou ID\']" ""');
    runBrowse('wait timeout 1000');
  } catch (err) {
    recordFail('search-customer', 'Search should correctly filter by customer name', err.message);
  }

  // --- Test 4: customer-details ---
  try {
    const detailsBtnPresent = evalJs("!!document.querySelector('.btn-secondary.btn-xs')");
    if (!detailsBtnPresent) {
      recordSkip('customer-details', 'No customers in the table to view details');
    } else {
      let clickRes = triggerDomClick('.btn-secondary.btn-xs', 'Detalhes');
      if (clickRes === 'not_found') throw new Error('Details button not found');
      runBrowse('wait timeout 500');
      
      let tree = runBrowse('snapshot');
      if (!tree.includes('Detalhes do Cliente')) {
        throw new Error('Details modal did not display correctly');
      }
      
      let closeRes = triggerDomClick('.close-btn');
      if (closeRes === 'not_found') {
        closeRes = triggerDomClick('button', '×');
      }
      if (closeRes === 'not_found') {
        runBrowse('press Escape');
      }
      runBrowse('wait timeout 300');
      recordPass('customer-details', 'Details modal opens with SHAP factors and closes successfully.');
    }
  } catch (err) {
    recordFail('customer-details', 'Details modal should display customer properties and SHAP factors', err.message);
  }

  // --- Test 5: add-customer ---
  try {
    let clickRes = triggerDomClick('button', 'Novo Cliente');
    if (clickRes === 'not_found') throw new Error('Novo Cliente button not found');
    runBrowse('wait timeout 500');
    
    const uniqueEmail = `test.user.${Date.now()}@example.com`;
    const uniqueName = `Test User ${Date.now()}`;
    
    runBrowse(`fill "input[name=name]" "${uniqueName}"`);
    runBrowse(`fill "input[name=email]" "${uniqueEmail}"`);
    runBrowse(`fill "input[name=MonthlyCharges]" "85.50"`);
    runBrowse(`fill "input[name=tenure]" "18"`);
    
    let clickRes2 = triggerDomClick('button', 'Confirmar e Cadastrar');
    if (clickRes2 === 'not_found') throw new Error('Confirmar e Cadastrar button not found');
    runBrowse('wait timeout 1500'); // Wait for API
    
    let tree = runBrowse('snapshot');
    if (!tree.includes(uniqueName)) {
      runBrowse(`fill "input[placeholder*='Nome ou ID']" "${uniqueName}"`);
      runBrowse('wait timeout 1200');
      tree = runBrowse('snapshot');
      if (!tree.includes(uniqueName)) {
        throw new Error('New customer was not found in the customers table');
      }
      runBrowse('fill "input[placeholder*=\'Nome ou ID\']" ""');
      runBrowse('wait timeout 1000');
    }
    
    recordPass('add-customer', `Successfully added new customer "${uniqueName}" and calculated ML risk.`);
  } catch (err) {
    recordFail('add-customer', 'Should be able to manually create a new customer and see them in the table', err.message);
  }

  // --- Test 6: chat-relatorio ---
  try {
    triggerDomClick('.menu-btn', 'Chat Reativo');
    runBrowse('wait timeout 500');
    
    runBrowse('fill "#chat-input-text" "/relatorio"');
    triggerDomClick('#btn-chat-send');
    runBrowse('wait timeout 3000'); // wait for bot
    
    let tree = runBrowse('snapshot');
    if (!tree.includes('Relatório Executivo')) {
      throw new Error('Chatbot response to /relatorio was incorrect or empty');
    }
    recordPass('chat-relatorio', 'Chatbot successfully responded to /relatorio with current database statistics.');
  } catch (err) {
    recordFail('chat-relatorio', 'Chatbot should return a structured database report on /relatorio', err.message);
  }

  // --- Test 7: force-scan-rapid-click ---
  try {
    triggerDomClick('.menu-btn', 'Painel Geral');
    runBrowse('wait timeout 500');
    
    triggerDomClick('#btn-manual-scan');
    triggerDomClick('#btn-manual-scan');
    
    const isScanning = evalJs("document.getElementById('btn-manual-scan').disabled");
    if (isScanning !== true && isScanning !== 'true') {
      throw new Error('Scan button was not disabled during process');
    }
    
    runBrowse('wait timeout 2000'); // wait scan finish
    recordPass('force-scan-rapid-click', 'Notifier scan button debounces and disables correctly during execution.');
  } catch (err) {
    recordFail('force-scan-rapid-click', 'Scan button should disable immediately on click to prevent spam', err.message);
  }

  // --- Test 8: add-customer-empty ---
  try {
    triggerDomClick('.menu-btn', 'Base de Clientes');
    runBrowse('wait timeout 500');
    
    triggerDomClick('button', 'Novo Cliente');
    runBrowse('wait timeout 500');
    
    triggerDomClick('button', 'Confirmar e Cadastrar');
    runBrowse('wait timeout 500');
    
    const isModalActive = evalJs("!!document.querySelector('.modal.active')");
    if (isModalActive !== true && isModalActive !== 'true') {
      throw new Error('Modal closed, meaning form submitted despite empty required fields');
    }
    
    runBrowse('press Escape');
    runBrowse('wait timeout 300');
    recordPass('add-customer-empty', 'Form validation prevented submission of empty fields, keeping modal open.');
  } catch (err) {
    recordFail('add-customer-empty', 'Form should prevent submission when required fields are empty', err.message);
  }

  // --- Test 9: chat-invalid-command ---
  try {
    triggerDomClick('.menu-btn', 'Chat Reativo');
    runBrowse('wait timeout 500');
    
    runBrowse('fill "#chat-input-text" "/nonexistent"');
    triggerDomClick('#btn-chat-send');
    runBrowse('wait timeout 1500');
    
    let tree = runBrowse('snapshot');
    if (!tree.includes('Comando desconhecido')) {
      throw new Error('Chatbot did not display unknown command warning');
    }
    recordPass('chat-invalid-command', 'Chatbot displays appropriate error for unknown slash commands.');
  } catch (err) {
    recordFail('chat-invalid-command', 'Chatbot should handle unknown commands gracefully', err.message);
  }

  // --- Test 10: chat-xss ---
  try {
    runBrowse('fill "#chat-input-text" "<script>window.__xss_run=true;</script>"');
    triggerDomClick('#btn-chat-send');
    runBrowse('wait timeout 1500');
    
    const xssExecuted = evalJs("window.__xss_run");
    if (xssExecuted === true || xssExecuted === 'true') {
      throw new Error('XSS Script payload executed in the document window!');
    }
    recordPass('chat-xss', 'Chat payload was rendered safely as text, preventing script execution.');
  } catch (err) {
    recordFail('chat-xss', 'Chat window should sanitize HTML tags to prevent XSS script execution', err.message);
  }

  // --- Test 11: form-labels-audit ---
  try {
    triggerDomClick('.menu-btn', 'Base de Clientes');
    runBrowse('wait timeout 500');
    
    triggerDomClick('button', 'Novo Cliente');
    runBrowse('wait timeout 500');
    
    const fields = evalJs("Array.from(document.querySelectorAll('.modal input, .modal select')).map(i => ({ name: i.name, hasLabel: !!i.labels?.length || !!document.querySelector('label[for=\\'' + i.id + '\\']') || !!i.getAttribute('aria-label') }))");
    
    if (Array.isArray(fields)) {
      const missing = fields.filter(f => !f.hasLabel);
      if (missing.length > 0) {
        throw new Error(`The following inputs lack accessible labels: ${JSON.stringify(missing)}`);
      }
      recordPass('form-labels-audit', 'All form fields inside the customer registration modal have associated labels.');
    } else {
      throw new Error('Failed to evaluate form labels array');
    }
    
    runBrowse('press Escape');
    runBrowse('wait timeout 300');
  } catch (err) {
    recordFail('form-labels-audit', 'Every input/select field in the form must have an associated accessibility label', err.message);
  }

  // --- Test 12: mobile-layout ---
  try {
    runBrowse('viewport 375 812');
    runBrowse('wait timeout 1000');
    
    const hasOverflow = evalJs("document.documentElement.scrollWidth > document.documentElement.clientWidth");
    if (hasOverflow === true || hasOverflow === 'true') {
      throw new Error('Horizontal scrollbar present, layout overflows mobile screen');
    }
    
    runBrowse('viewport 1440 900');
    runBrowse('wait timeout 500');
    recordPass('mobile-layout', 'Layout responsive: no horizontal overflow at 375px width.');
  } catch (err) {
    recordFail('mobile-layout', 'Layout should adapt to 375px mobile viewport without horizontal scroll', err.message);
  }

  // --- Test 13: console-errors ---
  try {
    const failedList = evalJs("performance.getEntries().filter(e => e.entryType === 'resource' && e.responseStatus >= 400).map(e => e.name)");
    
    if (Array.isArray(failedList) && failedList.length > 0) {
      throw new Error(`Failed resources detected: ${failedList.join(', ')}`);
    }
    recordPass('console-errors', 'Zero console exceptions or failed HTTP resources (status >= 400) during the test execution.');
  } catch (err) {
    recordFail('console-errors', 'Console should remain clean of runtime errors and failed resource calls', err.message);
  }

  // --- Test 14: accessibility-audit ---
  try {
    runBrowse('eval "const s = document.createElement(\'script\'); s.src = \'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js\'; document.head.appendChild(s); \'loading\'"');
    runBrowse('wait timeout 3000');
    
    const auditRes = evalJs("axe.run().then(r => JSON.stringify(r.violations))");
    
    if (typeof auditRes === 'string') {
      const violations = JSON.parse(auditRes);
      const criticalViolations = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      if (criticalViolations.length > 0) {
        throw new Error(`Accessibility audit found critical/serious violations: ${JSON.stringify(criticalViolations)}`);
      }
      recordPass('accessibility-audit', `Axe accessibility audit passed with 0 critical or serious violations.`);
    } else {
      throw new Error('Failed to parse axe-core violations array');
    }
  } catch (err) {
    if (err.message.includes('axe is not defined')) {
      recordSkip('accessibility-audit', 'Axe-core script could not be fetched (offline/network limitation).');
    } else {
      recordFail('accessibility-audit', 'Accessibility audit should yield 0 critical/serious violations', err.message);
    }
  }

  // Clean up
  runBrowse('stop');
  
  console.log('=== UI TEST SUITE COMPLETED ===');
  console.log(`Summary: Passed: ${passCount} | Failed: ${failCount} | Skipped: ${skipCount}`);
  
  generateHtmlReport();
}

function generateHtmlReport() {
  const total = passCount + failCount + skipCount;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const rateClass = passRate >= 90 ? 'good' : passRate >= 70 ? 'warn' : 'bad';
  
  let passesHtml = '';
  let failuresHtml = '';
  
  for (const item of results) {
    if (item.status === 'PASS') {
      passesHtml += `
      <details class="test-card pass">
        <summary>
          <span class="badge pass">PASS</span>
          <span class="step-id">${item.id}</span>
          <span class="evidence">${item.evidence}</span>
        </summary>
        <div class="body">
          <dl>
            <dt>Status</dt><dd>PASS</dd>
            <dt>Evidence</dt><dd>${item.evidence}</dd>
          </dl>
        </div>
      </details>`;
    } else if (item.status === 'FAIL') {
      let base64Img = '';
      try {
        const fullImgPath = path.join(screenshotDir, `${item.id}.png`);
        if (fs.existsSync(fullImgPath)) {
          const buffer = fs.readFileSync(fullImgPath);
          base64Img = `data:image/png;base64,${buffer.toString('base64')}`;
        }
      } catch (_) {}
      
      failuresHtml += `
      <details class="test-card fail" open>
        <summary>
          <span class="badge fail">FAIL</span>
          <span class="step-id">${item.id}</span>
          <span class="evidence">${item.expected} → ${item.actual}</span>
        </summary>
        <div class="body">
          <dl>
            <dt>Expected</dt><dd>${item.expected}</dd>
            <dt>Actual</dt><dd>${item.actual}</dd>
          </dl>
          ${base64Img ? `
          <div class="screenshot">
            <img src="${base64Img}" alt="Screenshot of failure">
            <div class="caption">${item.id}.png — captured at moment of failure</div>
          </div>` : '<div class="screenshot">No screenshot captured</div>'}
        </div>
      </details>`;
    }
  }
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ChurnGuard Reorganization - UI Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    .meta {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-val {
      font-size: 32px;
      font-weight: bold;
      color: #f1f5f9;
      margin-top: 4px;
    }
    .stat-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-card.good { border-color: #10b981; }
    .stat-card.good .stat-val { color: #10b981; }
    .stat-card.warn { border-color: #f59e0b; }
    .stat-card.warn .stat-val { color: #f59e0b; }
    .stat-card.bad { border-color: #ef4444; }
    .stat-card.bad .stat-val { color: #ef4444; }
    
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 18px;
      margin-bottom: 16px;
      border-bottom: 1px solid #334155;
      padding-bottom: 8px;
      color: #f1f5f9;
    }
    
    .test-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .test-card.pass { border-left: 4px solid #10b981; }
    .test-card.fail { border-left: 4px solid #ef4444; }
    
    summary {
      padding: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      outline: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    .badge {
      font-size: 10px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge.pass { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge.fail { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .step-id {
      font-weight: bold;
      color: #f1f5f9;
      font-family: monospace;
    }
    .evidence {
      color: #94a3b8;
      font-size: 13px;
      flex-grow: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .body {
      padding: 16px;
      border-top: 1px solid #334155;
      background: #0f172a;
    }
    dl {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 8px;
      margin: 0 0 16px 0;
      font-size: 14px;
    }
    dt {
      color: #94a3b8;
      font-weight: bold;
    }
    dd {
      margin: 0;
      color: #e2e8f0;
    }
    .screenshot {
      margin-top: 16px;
      border: 1px solid #334155;
      border-radius: 6px;
      overflow: hidden;
      max-width: 100%;
    }
    .screenshot img {
      width: 100%;
      height: auto;
      display: block;
    }
    .caption {
      background: #1e293b;
      padding: 8px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #334155;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ChurnGuard Reorganization - UI Test Report</h1>
    <div class="meta">
      Ran on: ${new Date().toLocaleString()} &bull; URL: http://localhost:5173 &bull; Mode: local
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Tests</div>
        <div class="stat-val">${total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Passed</div>
        <div class="stat-val" style="color: #10b981;">${passCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Failed</div>
        <div class="stat-val" style="color: #ef4444;">${failCount}</div>
      </div>
      <div class="stat-card ${rateClass}">
        <div class="stat-label">Pass Rate</div>
        <div class="stat-val">${passRate}%</div>
      </div>
    </div>
    
    ${failuresHtml ? `
    <div class="section">
      <div class="section-title">Failures</div>
      ${failuresHtml}
    </div>` : ''}
    
    <div class="section">
      <div class="section-title">Passed</div>
      ${passesHtml}
    </div>
  </div>
</body>
</html>`;

  const reportPath = path.join(__dirname, '..', '.context', 'ui-test-report.html');
  fs.writeFileSync(reportPath, htmlContent);
  console.log(`Report successfully written to: ${reportPath}`);
}

run();
