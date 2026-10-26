"use client";

import { t, useLocale } from "@/i18n";

/** Shared clarification at the arithmetic bench and the visible Act 4 ending. */
export function RsaContextNote() {
  useLocale((state) => state.locale);
  return (
    <aside className="space-y-2 rounded border border-stage-border bg-black/10 p-3 text-left text-xs leading-relaxed text-stage-muted">
      <h3 className="font-bold text-accent-teal">{t("Textbook arithmetic")}</h3>
      <p>
        {t(
          "The game breaks a toy protocol with tiny numbers and one letter at a time. This is not a break of real-world RSA.",
        )}
      </p>
      <p>
        {t(
          "Real RSA encryption uses far larger keys and encoding schemes such as RSAES-OAEP (RFC 8017), typically to protect key material rather than individual letters.",
        )}
      </p>
      <p>
        {t(
          "Shor’s algorithm threatens real RSA on a sufficiently large, reliable quantum computer, far beyond this demonstration.",
        )}
      </p>
    </aside>
  );
}
