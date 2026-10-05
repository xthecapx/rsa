# Quantum Playground: Qollab delivery

Implemented 2026-10-05. The uploadable package is generated locally. Native
Qiskit tests and a local browser preview have passed; execution inside Qollab's
Pyodide sandbox still needs the owner's test. The interrupted browser upload
was not verified, and no published version was created.

## Build and upload

```bash
cd game
npm ci
npm run build:qollab
npm run verify:qollab
```

Upload `game/dist/quantum-playground-qollab.zip` to
[Quantum Playground](https://qollab.xyz/u/xthecapx/quantum-playground#code):

1. Open **Edit Code**, then **Browse → Files** and select the ZIP.
2. Choose **Unpack**, then **Keep & add** to replace matching starter files.
   Retain `README.md` / the Project Card. Preserve all archive subdirectories.
3. Open **Run Project**, select a free **IBM noise-model simulator** (Marrakesh
   was tested natively), and run. Publish only after testing.

If uploading manually, upload the entire contents of `game/dist/qollab/`, with
paths intact. The archive contains 25 files and is approximately 1.2 MB compressed;
all individual files pass the 2 MB limit. JavaScript entry files alone are insufficient.

| Files | Purpose |
| --- | --- |
| `index.html`, `main.js`, `main.css` | Qollab HTML/JS entry and styles |
| `game.js`, `assets.js` | React/Excalibur game, embedded images/audio |
| `recorded.js` | Existing recorded IBM batches, without new IBM submissions |
| `quantum/` | Browser Python service adapter |
| `core/` | Shared classical alphabet, Caesar, and RSA helpers |
| `vendor/` | Portable QWARD 0.28.1 Shor circuit/analysis and attribution |
| `requirements.txt` | Qiskit version constraint |
| `assets/`, font licenses, `game.js.LEGAL.txt` | Required asset/dependency attribution |
| `build-info.json` | Build metadata |

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

Ghost Key retains its **25-bit secret plus one helper (26 total)**. Built-in
24-qubit and Braket local 25-qubit devices cannot execute it. IBM fake/noise
backends receive `method="matrix_product_state"` for that circuit, preserving
the selected backend and its noise model while avoiding dense statevector memory.
Device width alone is not a practical browser simulation guarantee.

Grover amplitude frames and Ghost Key phase frames are ideal explanatory
calculations. Actual outcomes come from the selected simulator; noise may cause
failure, and Ghost Key permits retry. Counts-only coin displays are labeled as
reconstructed when ordered shot memory is unavailable. The final toss uses one
actual measured shot and is persisted.

This export blocks physical hardware submissions. Recorded IBM views remain
recorded data. Browser-local puzzle tokens are inspectable educational state;
server signing secrets are not shipped. Saves remain local to the sandbox origin
and do not automatically transfer from the Cloud Run origin. If Qollab blocks
browser storage, the save stores retain progress in memory for the current run;
stopping or refreshing loses that fallback state. All stores keep their hydration
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
- Run the coin lesson, switch EN/ES with a result visible, close/reopen the laptop,
  and refresh/resume; the saved final toss must not rerun.
- Run three-round Grover and the full 26-qubit Ghost Key on an IBM simulator.
  Check a noisy wrong-key result can be retried without changing the device.
- Run N=15 Shor and inspect measured counts and factors; open recorded IBM views.
- Stop/restart Run and confirm there is one engine and one audio owner. Check
  participant browsers meet Qollab's JSPI requirements and localStorage survives.
- Test short landscape, portrait, and an input with the on-screen keyboard open.

Report the selected backend, the lesson/action, and Qollab's console error if any
step fails. Native Python validation does not prove Pyodide/provider compatibility.

For an optional local UI preview after building (not a Pyodide test):

```bash
cd game
../backend/.venv/bin/python tools/preview-qollab.py --backend ibm-marrakesh
```

Open `http://localhost:7027`. The development HTTP bridge is excluded from the ZIP.

Platform references: [JS projects](https://qollab.xyz/learn/docs/js-qiskit-projects),
[runtime environment](https://qollab.xyz/learn/docs/runtime-environment),
[Python projects](https://qollab.xyz/learn/docs/python-qiskit-projects),
[uploading files](https://qollab.xyz/learn/docs/upload-your-files), and
[ideal versus noise-model simulators](https://qollab.xyz/learn/docs/ideal-vs-noise-model-simulators).
