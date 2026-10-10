# qWard: A Quantum Computing Adventure — demo pitch

Practice guide for a 2–3 minute screen-sharing demo. Learn the sequence and speak
in your own words; the paragraphs below are prompts, not lines to read verbatim.
Aim for about two minutes of speech, leaving time for clicks and results.

## Before recording

- Open the game on an IBM noise-model simulator so you can demonstrate repeated
  runs. Use one backend throughout the recording.
- Have a Coin Town neighbor experiment ready, with a simple H circuit. Prepare a
  completed result as a backup if execution takes longer than the recording allows.
- Have a clear route to the campus or a checkpoint code ready, then show the lab.
  Use an existing save with equipment unlocked if you want to demonstrate it.
- Show one experiment clearly. Describe the later towns instead of trying to play
  every challenge in three minutes. Keep payment, credentials, and private tabs hidden.

## Opening — show the title and walk into Coin Town

“What if learning quantum computing felt like exploring a game, instead of
starting with a page of equations?

This is qWard: A Quantum Computing Adventure. It started with my idea to take
familiar problems from classical software development and let players explore
what changes when they approach them with quantum circuits.”

## Show one experiment — build, run, and explain the counts

“You begin in Coin Town with a simple question: who goes first? You meet people,
build circuits, and learn through their problems.

Here I’m preparing a qubit with a Hadamard gate and measuring it. When I press
Run, the game executes the circuit and shows the returned counts. The ideal
prediction is a reference; these bars are the measurements. With finite shots
and a noisy backend, the results can differ from that prediction.

That gives the player something to investigate: change the circuit, run again,
and explain what happened.”

## Show the campus and lab — explain the freedom to learn

“If a concept is unfamiliar, the optional campus introduces ideas like
superposition, entanglement, and decoherence through conversations, predictions,
and experiments.

There’s also a personal lab. Players can arrange their space, unlock equipment,
and try their own circuits, rotations, and algorithm boxes without a puzzle
telling them the answer.”

## Explain the journey — keep the game visible

“The adventure grows from that first coin into Grover search, a hidden-key oracle,
and finally a cryptography story with a tiny RSA demonstration. Each town gives
the next quantum idea a reason to matter.

The qWard name connects this game to the quantum-circuit analysis library I’m
developing during my PhD. For this hackathon, I adapted the existing game to
Qollab and expanded its learning spaces.”

## Close — return to the experiment or lab

“I’m submitting to Quantum Unlocked because the goal is to make difficult ideas
click through play. The game runs on Qollab, and the MIT-licensed source also
supports local play with a Python backend. It’s available in English and Spanish.

I want players to leave with a question they’re excited to test.

This effort is supported by Qollab & IonQ.”

## Five cues to remember

**Problem → experiment → measurements → freedom → invitation.**

If time is short, show only Coin Town and the lab. Explain the campus and later
towns while moving between them. If a result is still pending, show the prepared
result and say that it came from an earlier execution; do not imply it is the
current job. Explain the IonQ one-remote-job/restart limit only if asked or if
it affects the backend you are demonstrating.
