/** Entry hints belong to the iframe; never navigate the outer project page. */
const router = { replace: (path: string) => { window.dispatchEvent(new CustomEvent("quantum-playground-entry", { detail: path })); } };
export function useRouter() { return router; }
