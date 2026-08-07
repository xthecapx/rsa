import Link from "next/link";

import { ACT_NUMBERS, getAct } from "@/content";

export default function TitlePage() {
  return (
    <main className="h-screen w-screen overflow-y-auto bg-stage-bg">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent-teal">
          One street, one cable, one eavesdropper
        </p>
        <h1 className="mt-4 text-2xl leading-relaxed text-accent-amber">
          Man in the Middle
        </h1>
        <p className="mt-5 max-w-xl text-[12px] leading-relaxed text-stage-muted">
          Ale works in the building on the left. Brayan works in the building on
          the right. You are parked between them with a laptop and a junction
          box, and over four acts they try harder and harder to keep you out.
        </p>
        <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-stage-muted">
          Every attack you run here calls the real backend: real Caesar brute
          force, real RSA arithmetic, and a real Shor circuit on a simulator or
          on IBM hardware. Choose badly and Ale and Brayan start to notice.
        </p>

        <ul className="mt-10 space-y-3">
          {ACT_NUMBERS.map((act) => {
            const script = getAct(act);
            return (
              <li key={act}>
                <Link
                  href={`/play/${act}`}
                  className="panel group flex items-start gap-4 p-4 transition-colors hover:border-accent-amber"
                >
                  <span className="mt-0.5 shrink-0 border-2 border-stage-border px-2.5 py-1 text-[11px] text-accent-amber group-hover:border-accent-amber">
                    {act}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-[#e8f4f8]">
                      {script.title}
                      <span className="ml-2 text-[10px] text-stage-muted">
                        {script.subtitle}
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[11px] leading-relaxed text-stage-muted">
                      {script.brief}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-[10px] leading-relaxed text-stage-muted">
          City tiles and character busts by{" "}
          <a
            href="https://kenney.nl"
            className="text-accent-teal hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Kenney
          </a>{" "}
          (CC0). Rendered with{" "}
          <a
            href="https://excaliburjs.com/"
            className="text-accent-teal hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Excalibur.js
          </a>
          .
        </p>
      </div>
    </main>
  );
}
