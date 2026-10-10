# Quantum Playground

**Your next adventure starts with a coin toss.**

Meet curious neighbors, explore hidden places, and build circuits to solve their
problems. A coin toss leads to quantum searches, ghostly secrets, and a cryptographic heist.

## The idea behind the adventure

Quantum Playground grew from my idea to teach quantum computing through familiar
classical software problems: fair choices, searching, hidden information, and
cryptography. What changes when we try quantum circuits?

For this hackathon, I adapted the existing game to Qollab with shared Python
services, selected-backend measurements, and checkpoint codes, and added an
interactive campus and customizable quantum lab.

## A world to discover

- **Coin Town:** Settle who goes first while discovering gates, superposition, and measurement.
- **Quantum Campus — optional:** Explore a science fair covering kets, entanglement, decoherence, and other fundamentals.
- **Foundry Town:** Use interference and Grover’s algorithm to search sixteen hidden PINs.
- **Hollow Town:** Question an oracle and use phase kickback to recover the 25-bit Ghost Key.
- **Cipher Town:** Earn gear, intercept messages, and progress from simple ciphers to tiny RSA with Shor’s algorithm.
- **Quantum Town:** Revisit your favorite challenges.

## Make room for your own discoveries

Find your hidden cave lab, arrange your space, and unlock equipment with medals.
Experiment freely with gates, X/Y/Z rotations, Bloch spheres, and algorithm boxes.

## Before you set off

- **Controls:** Click/tap or use WASD/arrows to walk; Space to talk. Touch controls are available.
- **Progress:** Neighbor lessons are optional; challenge medals open roads.
- **Experiments:** Press Run for actual measurements; compare histograms with ideal references.
- **Checkpoints:** Keep your Save progress code before restarting or changing backends. It restores milestones.

On Qollab, select an **IBM noise-model simulator**, press **Run**, then enter the
game. No separate server or API keys are needed. Ghost Key needs 26 qubits; the
Shor demonstration uses N=15, not production-size RSA. IonQ remote simulators and
physical QPUs use local practice, reserving one remote job per Qollab code run for
a final challenge or lab experiment.

**Play in English or Spanish.**

## Run it or make it your own

Qollab runs a bundled build of the game, including Python services that use
Qollab’s runtime and your selected quantum backend. The editable source files
live in the [GitHub repository](https://github.com/xthecapx/rsa).

The same game also runs locally outside Qollab with its own Python backend server,
offering ideal and noisy simulations. Follow the repository’s
[local setup instructions](https://github.com/xthecapx/rsa#local-no-docker).
To recreate the Qollab bundle, run `npm ci` and `npm run build:qollab` in `game/`.
Extend lessons in `game/content/`, services in `backend/app/core/`, and translations in `game/i18n/`.

Original code and documentation are [MIT licensed](https://github.com/xthecapx/rsa/blob/main/LICENSE).
Third-party code, assets, and fonts retain their own licenses and notices.

**This effort is supported by Qollab & IonQ**
