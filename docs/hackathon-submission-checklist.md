# qWard: A Quantum Computing Adventure: hackathon submission checklist

Based on the rules supplied by the project owner. This is a preparation checklist,
not confirmation that the submission is published or eligible. The previous build
checks validate runtime packaging, not the hackathon's licensing requirements.

## 1. License and attribution — before submission

Licensing decision: qWard: A Quantum Computing Adventure's original code and documentation use
MIT. Third-party code, assets, and fonts keep their existing licenses and
notices; no third-party licensing changes are planned.

- [x] Add a root `LICENSE` with the full MIT text and the owner's copyright name
  and year. Cover original project code and documentation, including `game/`,
  `backend/`, and `frontend/`; retain third-party exceptions and notices.
- [x] Add a short License section to `README.md`, linking to `LICENSE` and
  explaining that third-party code, assets, and fonts retain their own licenses.
- [x] Add MIT metadata to the project's package manifests where applicable.
- [x] Include the project MIT license in the generated Qollab upload as `LICENSE`.
  Update `game/tools/build-qollab.mjs`, the exact allowlist in
  `game/tools/verify-qollab.mjs`, packaging tests, delivery documentation, and
  `AGENTS.md`. The upload now contains 20 files.
- [x] Preserve the existing third-party licensing policy and
  `THIRD-PARTY-NOTICES.txt`. Excalibur remains BSD-2-Clause, vendored QWARD remains
  Apache-2.0, Kenney assets remain CC0, and fonts remain OFL-1.1.
- [x] Prepare this exact attribution in the project-page copy and repository
  README: **This effort is supported by Qollab & IonQ**.

Current status: the MIT license, package metadata, project-page copy, and
attribution are prepared locally. The rebuilt upload contains 20 files, including
`LICENSE`, with all third-party notices retained. Changes still need to be
committed/pushed and uploaded by the owner.

## 2. Project page — update `docs/project-description.md`

Keep the adventure pitch and one phrase per town. Add short sections that cover:

- [x] **Origin and problem:** explain the author's existing game idea: teach
  quantum computing through familiar problems from classical software
  development, then explore quantum ways to address them.
- [x] **Hackathon contribution:** distinguish that original idea and any existing
  implementation from the work completed for the hackathon. Describe only
  verified contributions; record the relevant starting revision and final
  revision in the repository documentation if needed.
- [x] **What players do:** explore towns, talk to characters, assemble circuits,
  compare real returned measurements with ideal references, and experiment in
  the personal lab. Keep the optional campus and English/Spanish support visible.
- [x] **How to run:** select a supported backend, press Qollab Run, and enter the
  game. Recommend an IBM noise-model simulator for the complete adventure.
- [x] **Execution and progress:** briefly explain local practice versus remote
  final/lab jobs, the one-remote-job-per-code-run limit, and checkpoint codes
  before restarting or changing backends. Ghost Key needs 26 qubits; Qollab Shor
  uses the tiny N=15 demonstration. Link to technical details instead of expanding
  the pitch.
- [x] **Replicate and extend:** link to the public source, MIT license, and concise
  build/development documentation. Explain where lessons, shared services, and
  translations live.
- [x] Add the exact sponsor attribution above and state the project's MIT license
  with the third-party exception note.

Origin wording reference:

> qWard: A Quantum Computing Adventure grew from my idea for an adventure game that teaches quantum
> computing through familiar problems from classical software development. Players
> explore those problems, build quantum circuits, and compare what happens when
> they run them on ideal, noisy, or physical quantum backends.

The description identifies the Qollab adaptation, shared services, measurements,
checkpoint codes, campus, and lab as the hackathon work built on the existing game.
Avoid implying that every quantum algorithm outperforms classical methods or that
tiny RSA demonstrations break production RSA.

## 3. Reproduction files and source access

- [x] Verify source access: GitHub reports `xthecapx/rsa` is public. Commit and
  push this release so the new license and documentation become available there.
- [x] Keep `README.md` as the reproduction entry point: prerequisites, install,
  native run, Qollab build/upload, checks, and known backend limits.
- [x] Review `docs/qollab-deployment-plan.md` for stale status, package size/count,
  and claims about testing/publication. Record only tests actually performed.
- [x] Retain `game/qollab/requirements.txt`, dependency manifests/lockfiles,
  Python source, build scripts, asset licenses, and vendored QWARD notices in Git.
- [x] Keep generated distribution files ignored. Publish source and instructions
  for rebuilding the upload; do not add a ZIP.
- [x] Check for credential artifacts: only `.env.example` is tracked among env
  files; the tracked-source credential-pattern scan found no matches. The upload
  verifier excludes env/server artifacts. This is a limited check, not a full
  history or secret audit. Qollab needs no hosted API or player credentials.

## 4. Publish and verify on Qollab

- [ ] Record the exact submission deadline and timezone; neither was supplied
  with the quoted rules.
- [x] Rebuild and verify after license/documentation changes:

  ```bash
  cd game
  npm run check
  npm run build
  npm run build:qollab
  npm run verify:qollab
  ```

- [ ] Commit and push the source, license, and documentation changes.
- [ ] Upload the generated folder, preserving its Python subfolders, license,
  requirements, and notices. Update the project page separately.
- [ ] Smoke-test the uploaded version: boot, campus, town challenges, lab, real
  returned counts, English/Spanish, and checkpoint restore after a restart.
  Verify selected-backend behavior without unintentionally spending QPU credits.
- [ ] Publish before the deadline; verify the published project and description
  from a signed-out browser. A working editing preview is not publication.
- [ ] Record the public Qollab URL and final source revision in the submission.

## 5. Owner commitments

- [ ] Keep the project published and runnable on Qollab for the required 12 months.
  Confirm the period's start date from the full rules; preserve source access and
  recheck runtime compatibility when platform updates affect it.
- [ ] Provide a payment method through the organizers' designated private process
  if required for an award. Do not put payment details in the game, repository,
  project page, or this checklist.

Suggested order: add license and attribution → finalize
the concise description and reproduction notes → rebuild/upload → verify the
published project → submit.
