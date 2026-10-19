# qWard: A Quantum Computing Adventure: Qollab delivery

The uploadable package is generated locally. Native Qiskit tests, game checks,
production builds, and local browser checks have passed. The owner has reported
successful Qollab runs; each newly uploaded release still needs a platform smoke
test. On October 11, 2026, the public qWard v1.3 page was accessible while signed
out, and Rosa’s experiment returned 256 shots from `fake_pittsburgh`. See the
[submission review](submission-review.md) for coverage and remaining owner tasks.

## Build and upload

```bash
cd game
npm ci
npm run build:qollab
npm run verify:qollab
```

Upload the contents of `game/dist/qollab/` to
[qWard: A Quantum Computing Adventure](https://qollab.xyz/u/xthecapx/qward#code):

1. Open **Edit Code**, then upload the generated folder's contents.
2. Replace matching starter files and preserve all subdirectories.
   Retain `README.md` / the Project Card.
3. Open **Run Project**, select a free **IBM noise-model simulator** (Marrakesh
   was tested natively), and run. Publish only after testing.

The folder contains 20 files. Its current size and file hashes are recorded in
`game/dist/build-report.json`; every individual file must pass the 2 MB limit.
JavaScript entry files alone are insufficient.

| Files | Purpose |
| --- | --- |
| `index.html`, `main.js`, `main.css` | Qollab HTML/JS entry, runtime bridge, recorded IBM batches and styles |
| `game.js`, `assets.js` | React/Excalibur game, embedded images/audio |
| `quantum/` | Browser Python service adapter |
| `core/` | Canonical game services, coin circuits, Shor processing, and classical helpers copied from `backend/app/core/` |
| `vendor/` | Portable QWARD 0.28.1 Shor circuit/analysis |
| `requirements.txt` | Explicit Qiskit version constraint for the Python runtime |
| `LICENSE` | MIT license for original project code and documentation |
| `THIRD-PARTY-NOTICES.txt` | Full dependency, asset, font and QWARD attribution |
| `../build-report.json` | Review metadata; excluded from the platform upload |

Original project code and documentation use MIT. Third-party materials retain
their own licenses in the consolidated notices. Copy
[`project-description.md`](project-description.md) into the Qollab project page,
including the exact attribution: **This effort is supported by Qollab & IonQ**.
See the [submission checklist](hackathon-submission-checklist.md) for owner tasks.

The normal `npm run build` and Cloud Run deployment retain FastAPI/Aer. The
Qollab target needs no hosted Python server, API URL, or provider credential.
Python remains part of the distribution and runs inside Qollab's browser runtime.

## Backend behavior

The JavaScript bootstrap passes Qollab's injected `backend` to Python via
`callPromising`. It queues requests and preserves existing client result/save
contracts. It does not construct a replacement quantum backend. The included
Python helpers execute real coin, Grover, Bernstein–Vazirani, and N=15 Shor
circuits. Shor factors come from measurement analysis and verified classical
processing. Larger Shor moduli are explicitly unsupported in this browser release.
Coin Town's X/Z/H benches execute the player's gates for each displayed initial
state with 256 shots, using the same circuit builder as FastAPI. Barriers keep H→H
from being optimized away. Histograms display returned counts; ideal ket traces,
probabilities, and interference illustrations are labeled references. Noisy
measurements never decide whether a correctly designed exercise earns its card.

Ghost Key retains its **25-bit secret plus one helper (26 total)**. Built-in
24-qubit and Braket local 25-qubit devices cannot execute it. IBM fake/noise
backends receive `method="matrix_product_state"` for that circuit, preserving
the selected backend and its noise model while avoiding dense statevector memory.
Device width alone is not a practical browser simulation guarantee.

Grover amplitude frames and Ghost Key phase frames are ideal explanatory
calculations. Actual outcomes come from the selected backend; noise may cause
failure, and Ghost Key permits retry. Counts-only coin displays are labeled as
reconstructed when ordered shot memory is unavailable. The final toss uses one
actual measured shot and is persisted.

Physical hardware submissions are enabled for the backend selected in Qollab.
Only an explicit player Run submits work. Calls stay queued until provider results
arrive; the HTTP timeout does not race or retry an in-flight QPU submission.
The provider job ID is printed to Qollab’s console before waiting. Hardware-backed
counts carry `source=hardware` and the selected backend name; unavailable ordered
shot memory is reconstructed explicitly. This path has been tested with a local
provider double, not by spending credits on a live device. Recorded IBM views
remain recorded data and remain a separate RSA choice. Browser-local puzzle tokens are inspectable educational state;
server signing secrets are not shipped. The server version saves to browser
storage; Qollab's sandbox blocks persistent storage. Its save stores retain
progress in memory for the current run; stopping or refreshing loses that fallback
state. Short checkpoint codes work in either version. All stores keep their hydration
APIs so blocked storage does not strand boot on the scene-loading screen.

The bundle embeds assets because uploaded project files are not a normal public
asset directory. It includes browser navigation shims and an Excalibur feature
probe adaptation for the sandbox's blocked XMLHttpRequest. It does not install
or manipulate service workers; the normal web target keeps its PWA behavior.
Fonts use version-pinned HTTPS Fontsource CDN URLs because the sandbox's
`font-src *` directive blocks embedded data fonts. System fonts are the fallback
if the CDN is unreachable; font license files remain in the distribution.

## Owner's Qollab test checklist

- Verify boot, fonts, sprites, music unlock/mute, and movement with keyboard and touch.
- Run the coin lesson, switch EN/ES with a result visible, and close/reopen the
  laptop; the final toss must not rerun. Keep a checkpoint code before restarting
  and restore it afterward; restoration must not submit a circuit.
- Run three-round Grover and the full 26-qubit Ghost Key on an IBM simulator.
  Check a noisy wrong-key result can be retried without changing the device.
- Run N=15 Shor and inspect measured counts and factors; open recorded IBM views.
- Stop/restart Run and confirm there is one engine and one audio owner. Check
  participant browsers meet Qollab's JSPI requirements.
- Test short landscape, portrait, and an input with the on-screen keyboard open.

Report the selected backend, the lesson/action, and Qollab's console error if any
step fails. Native Python validation does not prove Pyodide/provider compatibility.

For an optional local UI preview after building (not a Pyodide test):

```bash
cd game
../backend/.venv/bin/python tools/preview-qollab.py --backend ibm-marrakesh
```

Open `http://localhost:7027`. The development HTTP bridge is excluded from the upload folder.

Platform references: [JS projects](https://qollab.xyz/learn/docs/js-qiskit-projects),
[runtime environment](https://qollab.xyz/learn/docs/runtime-environment),
[Python projects](https://qollab.xyz/learn/docs/python-qiskit-projects),
[uploading files](https://qollab.xyz/learn/docs/upload-your-files), and
[ideal versus noise-model simulators](https://qollab.xyz/learn/docs/ideal-vs-noise-model-simulators).

## One place to change backend behavior

Edit `backend/app/core/game_services.py` for Coin, Grover, Ghost Key, and shared
classical response behavior; edit `backend/app/core/shor_service.py` for Shor plans
and measurement processing. FastAPI and Qollab use these same source modules.
The Qollab build copies `core/` unchanged, including new modules, into the bundle.
Runtime adapters retain HTTP schemas/timeouts, server token signatures, local Aer
configuration, and Qollab's injected backend and N=15 browser capability limit.
The vendored QWARD algorithm remains a licensed external dependency.
Rebuild with `cd game && npm run build:qollab`, then replace the uploaded folder
contents so Qollab receives the new shared Python files too.

## Server preference and additional maps

The native game’s Simulation selector persists separately from progress. A request
header selects ideal Aer or an educational Aer noise model. This header is ignored
for Qollab, which uses local ideal practice and reserves IonQ for final challenges. Both targets share
register circuit construction and shot processing. Foundry/Hollow benches and the
rounds dial execute 256 shots; Grover previews also sample 256 shots in anonymous
bar order. Final coin/PIN/key decisions remain single measured shots. Ideal traces
and card criteria remain references and never become fabricated measured counts.
Verify that changing a preference affects a subsequent run but retains earlier
counts, that noisy Ghost Key can retry a failed key, and that the RSA recorded-data
option never submits new work. For live QPU validation, select a physical backend
in Qollab and perform one deliberate Run after checking provider costs/credits;
this implementation did not submit a live test job.

IonQ remote policy: practice circuits execute on BasicSimulator. The Coin final
toss, Grover final measurement, Ghost Key recovery, and RSA Shor simulation use
the selected remote backend, with one submission per Qollab code Run. Stop and
Run again after collecting the badge or before retrying a noisy failure. Keep
the checkpoint code before restarting and restore it afterward. The shared
checkpoint menu offers the same short-code lesson shortcuts in both versions.
Ghost Key requires a 29-qubit Forte simulator rather than 25-qubit Aria.

The generated distribution contains exactly 19 upload files and is ignored by Git.
Rebuild it locally; commit the source and build tools. The report
sits beside `dist/qollab/` and stays outside the upload. No ZIP is generated. JS and
CSS use esbuild minification, unused public assets are omitted conservatively,
and recorded data joins the bootstrap. Python module boundaries remain intact
so both backend targets still use the canonical core. Requirements are copied
from the Qollab source folder. Attribution is consolidated, never discarded. Remove
obsolete files from older Qollab uploads when replacing the project tree.
