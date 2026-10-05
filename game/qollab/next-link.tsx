import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && href?.startsWith("/")) {
      event.preventDefault();
      // World navigation normally supplies onBack/onReturn/onNext handlers.
      window.dispatchEvent(new CustomEvent("quantum-playground-entry", { detail: href }));
    }
  }} />;
}
