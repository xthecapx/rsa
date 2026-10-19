import './assets.js';
import * as services from 'quantum.services';
import { mountGame } from './game.js';
import { batches, recorded } from './recorded.js';
import { createRequestQueue } from './requestQueue';

// Keep one Python call active at a time. Qollab owns the provider and its network.
// HTTP's AbortSignal.timeout does not cancel a Pyodide/provider job; do not race
// it against a new submission. The game's generation guards still own results.
const enqueue = createRequestQueue();
let stopped = false;
const info = JSON.parse(await services.describe_json.callPromising(backend));
const request = (path, init, progress) => {
  const work = async () => {
    if (stopped) throw new Error('The game run has stopped.');
    if (path.startsWith('/api/ibm/')) {
      const data = path === '/api/ibm/batches' ? { batches }
        : path === '/api/ibm/cached' ? recorded.m8
        : recorded[decodeURIComponent(path.slice('/api/ibm/batch/'.length))];
      return new Response(JSON.stringify(data ?? { detail: 'Unknown recorded batch' }), { status: data ? 200 : 404 });
    }
    let remoteReserved = false;
    const notify = (state, jobId = '') => {
      if (String(state) === 'remote_reserved') { remoteReserved = true; return; }
      if (!stopped && String(state) !== 'idle') progress?.({ state: String(state), jobId: String(jobId) });
    };
    notify('preparing');
    let result;
    try {
      result = JSON.parse(await services.dispatch_json.callPromising(backend, path, init?.body ?? '{}', notify));
    } finally {
      notify('idle');
      if (remoteReserved && !stopped) window.dispatchEvent(new Event('quantum-remote-used'));
    }
    if (stopped) throw new Error('The game run has stopped.');
    return new Response(JSON.stringify(result.data), { status: result.status });
  };
  return enqueue(work, progress);
};

const status = document.getElementById('quantum-runtime-status');
status.textContent = `Qollab · ${info.backend} · ${info.kind}. Ghost Key needs 26 qubits.`;
globalThis.quantumPlaygroundDispose?.();
const dispose = mountGame({ request, backend: info.backend, kind: info.kind, remoteFinalOnly: info.remote_final_only });
globalThis.quantumPlaygroundDispose = () => { stopped = true; dispose(); };
window.addEventListener('pagehide', globalThis.quantumPlaygroundDispose, { once: true });
// Keep the interactive runtime active after main.js mounts the page. Stop
// tears down the iframe; no startup circuit or job is submitted automatically.
await new Promise((resolve) => window.addEventListener('pagehide', resolve, { once: true }));
