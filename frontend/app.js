/**
 * CodeSite AI — app.js
 *
 * Drives the frontend UI for the multi-agent pipeline:
 *   Planner → Architect → Coder (loop)
 *
 * Communicates with the Python backend via a local REST API:
 *   POST /api/build   { prompt }  → streams JSON events
 *
 * Event shape from the server (newline-delimited JSON):
 *   { stage: "planner"|"architect"|"coder"|"done"|"error", data: { ... } }
 *
 * File structure mirrored from agent/:
 *   graph.py   → orchestrates the pipeline
 *   states.py  → Plan, TaskPlan, CoderState schemas
 *   tools.py   → write_file, read_file, list_files
 */

// ─────────────────────────────────────────────────────────────
// API CONFIGURATION
// ─────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000';       // adjust if your server runs elsewhere
const BUILD_ENDPOINT = `${API_BASE}/api/build`;

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

const state = {
  isRunning: false,
  generatedFiles: {},    // { filename: content }
  activeTab: null,
};

// ─────────────────────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const dom = {
  promptInput:    $('#promptInput'),
  charCount:      $('#charCount'),
  buildBtn:       $('#buildBtn'),
  statusDot:      $('#statusDot'),
  statusLabel:    $('#statusLabel'),
  terminalBody:   $('#terminalBody'),
  resultSection:  $('#resultSection'),
  fileTabs:       $('#fileTabs'),
  fileCode:       $('#fileCode'),
  copyAllBtn:     $('#copyAllBtn'),
  plannerOutput:  $('#plannerOutput'),
  architectOutput:$('#architectOutput'),
  coderOutput:    $('#coderOutput'),
  stagePlanner:   $('#stagePlanner'),
  stageArchitect: $('#stageArchitect'),
  stageCoder:     $('#stageCoder'),
};

const stages = {
  planner:   { el: dom.stagePlanner,   output: dom.plannerOutput },
  architect: { el: dom.stageArchitect, output: dom.architectOutput },
  coder:     { el: dom.stageCoder,     output: dom.coderOutput },
};

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Returns a zero-padded HH:MM:SS timestamp string.
 */
function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

/**
 * Appends a line to the terminal log.
 * @param {string} message
 * @param {'default'|'accent'|'warn'|'error'} type
 */
function log(message, type = 'default') {
  const line = document.createElement('div');
  line.className = 'log-line';

  const ts  = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = timestamp();

  const msg = document.createElement('span');
  msg.className = `msg${type !== 'default' ? ' ' + type : ''}`;
  msg.textContent = message;

  line.appendChild(ts);
  line.appendChild(msg);
  dom.terminalBody.appendChild(line);
  dom.terminalBody.scrollTop = dom.terminalBody.scrollHeight;
}

/**
 * Clears the terminal body.
 */
function clearTerminal() {
  dom.terminalBody.innerHTML = '';
}

/**
 * Sets the header status indicator.
 * @param {'idle'|'running'|'done'|'error'} status
 */
function setStatus(status) {
  dom.statusDot.className = `status-dot ${status === 'idle' ? '' : status}`;
  dom.statusLabel.textContent = status;
}

/**
 * Activates a pipeline stage visually.
 * @param {'planner'|'architect'|'coder'} stageName
 * @param {'active'|'done'|'error'} stageStatus
 */
function setStage(stageName, stageStatus) {
  const { el } = stages[stageName];
  el.classList.remove('active', 'done', 'error');
  if (stageStatus) el.classList.add(stageStatus);
}

/**
 * Writes text into a stage's output area.
 * @param {'planner'|'architect'|'coder'} stageName
 * @param {string} text
 */
function setStageOutput(stageName, text) {
  stages[stageName].output.textContent = text;
}

/**
 * Resets all pipeline stages to their idle (dimmed) state.
 */
function resetStages() {
  Object.keys(stages).forEach((name) => {
    stages[name].el.classList.remove('active', 'done', 'error');
    stages[name].output.textContent = '';
  });
}

/**
 * Deep-copies text to the clipboard. Shows brief feedback on the button.
 * @param {string} text
 * @param {HTMLElement} btn
 */
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  } catch {
    log('Clipboard write failed — please copy manually.', 'warn');
  }
}

// ─────────────────────────────────────────────────────────────
// FILE TABS
// ─────────────────────────────────────────────────────────────

/**
 * Renders the file tab bar and populates the code viewer.
 * @param {Record<string, string>} files  filename → content
 */
function renderFileTabs(files) {
  dom.fileTabs.innerHTML = '';
  const filenames = Object.keys(files);
  if (filenames.length === 0) return;

  filenames.forEach((name) => {
    const btn = document.createElement('button');
    btn.className = 'file-tab';
    btn.textContent = name;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.addEventListener('click', () => activateTab(name));
    dom.fileTabs.appendChild(btn);
  });

  activateTab(filenames[0]);
}

/**
 * Switches the active file tab.
 * @param {string} filename
 */
function activateTab(filename) {
  state.activeTab = filename;

  dom.fileTabs.querySelectorAll('.file-tab').forEach((btn) => {
    const isActive = btn.textContent === filename;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  dom.fileCode.textContent = state.generatedFiles[filename] ?? '';
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS: PLANNER DATA
// ─────────────────────────────────────────────────────────────

/**
 * Processes a planner stage event from the server.
 * Expects data: { name, description, techstack, features, files }
 * @param {object} data
 */
function handlePlannerEvent(data) {
  setStage('planner', 'active');
  const summary = [
    `▸ ${data.name ?? 'Unnamed app'}`,
    data.techstack ? `  stack: ${data.techstack}` : '',
    data.features?.length ? `  features: ${data.features.slice(0, 3).join(', ')}${data.features.length > 3 ? '…' : ''}` : '',
  ].filter(Boolean).join('\n');
  setStageOutput('planner', summary);
  log(`Planner → "${data.name}"`, 'accent');
  if (data.description) log(`  ${data.description}`);
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS: ARCHITECT DATA
// ─────────────────────────────────────────────────────────────

/**
 * Processes an architect stage event from the server.
 * Expects data: { implementation_steps: [{ filepath, task_description }] }
 * @param {object} data
 */
function handleArchitectEvent(data) {
  setStage('planner', 'done');
  setStage('architect', 'active');
  const steps = data.implementation_steps ?? [];
  const summary = steps.map((s, i) => `${i + 1}. ${s.filepath}`).join('\n');
  setStageOutput('architect', summary || 'Building task plan…');
  log(`Architect → ${steps.length} task(s) planned`, 'accent');
  steps.forEach((s) => log(`  → ${s.filepath}`));
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS: CODER DATA
// ─────────────────────────────────────────────────────────────

/**
 * Processes a coder step event from the server.
 * Expects data: { step, total, filepath, content }
 * @param {object} data
 */
function handleCoderEvent(data) {
  setStage('architect', 'done');
  setStage('coder', 'active');

  const { step, total, filepath, content } = data;
  setStageOutput('coder', `Step ${step}/${total}\n→ ${filepath}`);
  log(`Coder [${step}/${total}] → ${filepath}`, 'accent');

  if (filepath && content !== undefined) {
    state.generatedFiles[filepath] = content;
    renderFileTabs(state.generatedFiles);
    dom.resultSection.hidden = false;
  }
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS: DONE / ERROR
// ─────────────────────────────────────────────────────────────

function handleDoneEvent(data) {
  setStage('coder', 'done');
  setStatus('done');
  log('Build complete ✓', 'accent');
  if (data?.message) log(`  ${data.message}`);
  unlockUI();
}

function handleErrorEvent(data) {
  const errorStage = data?.stage ?? 'unknown';
  setStage(errorStage in stages ? errorStage : 'coder', 'error');
  setStatus('error');
  log(`Error in ${errorStage}: ${data?.message ?? 'unknown error'}`, 'error');
  unlockUI();
}

// ─────────────────────────────────────────────────────────────
// BUILD — STREAMING SSE / NDJSON
// ─────────────────────────────────────────────────────────────

/**
 * Sends the prompt to the backend and processes the streaming response.
 * The backend should respond with newline-delimited JSON events.
 * @param {string} prompt
 */
async function runBuild(prompt) {
  try {
    const response = await fetch(BUILD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    // Read the streaming body line-by-line (newline-delimited JSON)
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();          // last element may be an incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          dispatchEvent(event);
        } catch {
          log(`Unparseable response: ${trimmed}`, 'warn');
        }
      }
    }

    // Flush any remaining buffer content
    if (buffer.trim()) {
      try {
        dispatchEvent(JSON.parse(buffer.trim()));
      } catch { /* ignore incomplete final line */ }
    }

  } catch (err) {
    handleErrorEvent({ stage: 'network', message: err.message });
  }
}

/**
 * Routes a parsed server event to the appropriate handler.
 * @param {{ stage: string, data: object }} event
 */
function dispatchEvent(event) {
  const { stage, data = {} } = event;
  switch (stage) {
    case 'planner':   handlePlannerEvent(data);   break;
    case 'architect': handleArchitectEvent(data); break;
    case 'coder':     handleCoderEvent(data);     break;
    case 'done':      handleDoneEvent(data);      break;
    case 'error':     handleErrorEvent(data);     break;
    default:
      log(`[${stage}] ${JSON.stringify(data)}`, 'warn');
  }
}

// ─────────────────────────────────────────────────────────────
// UI LOCK / UNLOCK
// ─────────────────────────────────────────────────────────────

function lockUI() {
  state.isRunning = true;
  dom.buildBtn.disabled = true;
  dom.promptInput.disabled = true;
}

function unlockUI() {
  state.isRunning = false;
  dom.buildBtn.disabled = false;
  dom.promptInput.disabled = false;
}

// ─────────────────────────────────────────────────────────────
// BUILD TRIGGER
// ─────────────────────────────────────────────────────────────

async function startBuild() {
  const prompt = dom.promptInput.value.trim();
  if (!prompt) {
    log('Please enter a project description first.', 'warn');
    dom.promptInput.focus();
    return;
  }
  if (state.isRunning) return;

  // Reset UI
  clearTerminal();
  resetStages();
  state.generatedFiles = {};
  dom.resultSection.hidden = true;
  dom.fileTabs.innerHTML = '';
  dom.fileCode.textContent = '';

  setStatus('running');
  lockUI();
  log(`Starting build: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`, 'accent');

  await runBuild(prompt);
}

// ─────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Character counter
  dom.promptInput.addEventListener('input', () => {
    dom.charCount.textContent = dom.promptInput.value.length;
  });

  // Build button
  dom.buildBtn.addEventListener('click', startBuild);

  // Ctrl+Enter shortcut in textarea
  dom.promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      startBuild();
    }
  });

  // Example chips — fill textarea on click
  document.querySelectorAll('.example-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.promptInput.value = chip.dataset.prompt;
      dom.charCount.textContent = chip.dataset.prompt.length;
      dom.promptInput.focus();
    });
  });

  // Copy All button
  dom.copyAllBtn.addEventListener('click', () => {
    const allContent = Object.entries(state.generatedFiles)
      .map(([name, content]) => `// ── ${name} ──\n${content}`)
      .join('\n\n');
    copyToClipboard(allContent, dom.copyAllBtn);
  });

});