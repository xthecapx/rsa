/**
 * The laptop calculator: whole numbers only, exact at any size (BigInt), with
 * the operations the benches use. `mod` and `^` bind like the board writes
 * them: 4^3 mod 7 is (4^3) mod 7, and 2 + 3 mod 4 is 2 + (3 mod 4).
 */
export type CalcResult = { value: bigint } | { error: string };

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** Turn a slot's math (4³ mod 7, gcd(49 − 1, 15), 3·11) into calculator input; null when it has a letter to solve for. */
export function calcInput(ask: string): string | null {
  const text = ask.replace(/^[a-zA-Zφ]+\s*=\s*/, "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (digits) => `^${[...digits].map((d) => SUP.indexOf(d)).join("")}`)
    .replace(/[·×]/g, "×").replace(/−/g, "-").trim();
  const words = text.replace(/\bmod\b|\bgcd\b/g, "");
  // Only sums: a lone number or a letter to solve for has nothing to work out.
  return /[a-zA-Zφ=:]/.test(words) || !/\d/.test(text) || !/[+\-×÷^]|mod|gcd/.test(text) ? null : text;
}

type Token = { kind: "num"; value: bigint } | { kind: "op"; op: string } | { kind: "open" } | { kind: "close" } | { kind: "comma" } | { kind: "gcd" };
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const text = input.replace(/\s+/g, " ").trim();
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === " ") { i++; continue; }
    if (/\d/.test(ch)) { let j = i; while (j < text.length && /\d/.test(text[j])) j++; tokens.push({ kind: "num", value: BigInt(text.slice(i, j)) }); i = j; continue; }
    if (text.startsWith("mod", i)) { tokens.push({ kind: "op", op: "mod" }); i += 3; continue; }
    if (text.startsWith("gcd", i)) { tokens.push({ kind: "gcd" }); i += 3; continue; }
    if ("+-×*·÷/^".includes(ch)) { tokens.push({ kind: "op", op: ch === "*" || ch === "·" ? "×" : ch === "/" ? "÷" : ch }); i++; continue; }
    if (ch === "(") { tokens.push({ kind: "open" }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "close" }); i++; continue; }
    if (ch === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    throw new Error("That isn’t a calculator key");
  }
  return tokens;
}

const LEVEL: Record<string, number> = { "+": 1, "-": 1, "×": 2, "÷": 2, mod: 2, "^": 3 };
const ZERO = BigInt(0), MAX_EXPONENT = BigInt(4096);
function gcdBig(a: bigint, b: bigint): bigint { a = a < ZERO ? -a : a; b = b < ZERO ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
function apply(op: string, a: bigint, b: bigint): bigint {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": if (b === ZERO) throw new Error("Can’t divide by 0"); return a / b;
    case "mod": if (b === ZERO) throw new Error("mod 0 has no meaning"); return ((a % b) + b) % b;
    default:
      if (b < ZERO) throw new Error("Negative powers aren’t whole numbers");
      if (b > MAX_EXPONENT) throw new Error("That power is too big to show");
      return a ** b;
  }
}

/** Precedence climbing over the token list; `^` is right-associative. */
export function calculate(input: string): CalcResult {
  try {
    const tokens = tokenize(input);
    if (!tokens.length) return { error: "Type or tap a sum" };
    let at = 0;
    const peek = () => tokens[at];
    const expression = (min: number): bigint => {
      let left = operand();
      for (;;) {
        const token = peek();
        if (!token || token.kind !== "op" || LEVEL[token.op] < min) return left;
        at++;
        const right = expression(token.op === "^" ? LEVEL[token.op] : LEVEL[token.op] + 1);
        left = apply(token.op, left, right);
      }
    };
    const operand = (): bigint => {
      const token = tokens[at++];
      if (!token) throw new Error("The sum ends too early");
      if (token.kind === "num") return token.value;
      if (token.kind === "op" && token.op === "-") return -operand();
      if (token.kind === "open") { const value = expression(1); if (tokens[at++]?.kind !== "close") throw new Error("A bracket is missing"); return value; }
      if (token.kind === "gcd") {
        if (tokens[at++]?.kind !== "open") throw new Error("Write gcd(a, b)");
        const a = expression(1);
        if (tokens[at++]?.kind !== "comma") throw new Error("Write gcd(a, b)");
        const b = expression(1);
        if (tokens[at++]?.kind !== "close") throw new Error("A bracket is missing");
        return gcdBig(a, b);
      }
      throw new Error("Something is missing between the numbers");
    };
    const value = expression(1);
    if (at < tokens.length) throw new Error("Something is missing between the numbers");
    return { value };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
