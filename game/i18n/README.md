# Narrative and translation guide

The English dialogue and lesson text live in `../content/`. Interface copy also
lives in `../components/` and the feedback returned by `../game/`. `es.json` uses
the English display message as its key. Edit the English and Spanish together.

## Voice

Use short, conversational sentences. Give each character a distinct voice while
keeping the player’s next action clear. Preserve the game’s lamps, paint, bells,
ghosts, and padlocks as metaphors; explain the quantum idea behind each metaphor.
Name the actual requirement rather than saying a badge “needs everything.”

Keep English spelling and punctuation consistent within each lesson. Spanish uses
broadly understandable Latin American phrasing and informal singular instructions: “prepara,” “arrastra,” and
“mide.” Rewrite idioms for their meaning rather than translating each word.

| English | Spanish |
| --- | --- |
| qubit / qubits | cúbit / cúbits |
| gate | compuerta |
| shot / shots | ejecución / ejecuciones |
| laptop | portátil |
| helper qubit | cúbit auxiliar |
| phase kickback | retroceso de fase |
| plaintext | texto sin cifrar; texto claro in compact tool labels |
| ciphertext | texto cifrado |
| sniffer / listener device | dispositivo de escucha |
| vault tumbler | cilindro |
| vault’s secret mask | código secreto |

Use “equilibrada” for a fair coin. Keep “cara” and “sello” consistent. Town names
are Pueblo Moneda, Pueblo Forja, Pueblo Sepulcral, Pueblo Cifrado, and Pueblo cuántico.
Keep Quantum Playground as the game’s name.

For example, “A house that knocks” becomes “Golpes en la casa,” and “Solve it
with quantum” becomes an instruction naming Grover’s search. These convey the
scene and the action without literal phrases that sound unnatural in Spanish.

## Scientific clarity

Distinguish a simulated coin from physical quantum randomness. Describe
superposition using amplitudes and measurement probabilities. A shot starts
with a fresh circuit preparation; repeating a preparation differs from repeatedly
measuring one qubit.

Grover increases the success probability; it does not guarantee the answer for
every search size. The sixteen-PIN lesson reaches about 96% after three rounds.
Its oracle and diffuser form one round; the initial H layer prepares the register.
See [IBM’s Grover lesson](https://quantum.cloud.ibm.com/learning/en/modules/computer-science/grovers).

The vault’s parity oracle differs from an oracle that checks a complete key.
Bernstein–Vazirani learns an n-bit parity secret with one ideal quantum query,
compared with n classical queries. Calling that advantage exponential is
incorrect. See [the Bernstein–Vazirani exercise and solution from Freie Universität Berlin](https://www.physik.fu-berlin.de/en/einrichtungen/ag/ag-eisert/teaching/ws23-24/sheet_10_solutions.pdf).

Shor’s quantum circuit returns measurement samples. Classical processing derives
and checks a candidate period and then computes factors. The base must be
coprime to N; the factor extraction also needs an even period and a suitable
halfway value. Keep the tiny demonstration modulus distinct from real RSA key
sizes. See [IBM’s Shor tutorial](https://quantum.cloud.ibm.com/docs/en/tutorials/shors-algorithm).

## Translation integrity

Translate display text only. Preserve every `{placeholder}`, formula, code
instruction, puzzle answer, state ID, and request value. Translate surrounding
explanations and labels, including labels in technical displays.

Keep the old English keys when revising messages that may appear in saved RSA
checkpoints. They intentionally remain as aliases so older saves still display
the revised Spanish. Unknown backend diagnostics continue to use the existing
fallback.

Run `npm test` from `game/` to check translation coverage, placeholders, and
puzzle behavior. Use `npx tsc --noEmit` and `npm run build` for TypeScript and
production validation.
