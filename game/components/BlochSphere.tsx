"use client";
import { t } from "@/i18n";
/** Mathematical state reference; histogram counts alone do not reconstruct it. */
export function BlochSphere({
  vector: bloch,
  explanation = "Ideal Bloch reference. Rotate around X, Y or Z to explore the whole sphere; measurement counts do not reconstruct this state.",
}: {
  vector: { x: number; y: number; z: number };
  explanation?: string;
}) {
  // Orthographic projection: X and Y cross the equatorial plane; Z points up.
  const blochPoint = {
    x: 65 * ((Math.sqrt(3) / 2) * bloch.x - 0.5 * bloch.y),
    y:
      65 *
      (Math.sin(Math.PI / 9) * (0.5 * bloch.x + (Math.sqrt(3) / 2) * bloch.y) -
        Math.cos(Math.PI / 9) * bloch.z),
  };
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <svg
        viewBox="0 0 220 180"
        className="w-56"
        role="img"
        aria-label={t("Ideal Bloch sphere")}
      >
        <circle cx="100" cy="90" r="65" fill="#123941" stroke="#90e0cd" />
        <ellipse
          cx="100"
          cy="90"
          rx="65"
          ry="20"
          fill="none"
          stroke="#63858a"
        />
        <path d="M44 79l112 22 M100 29v122 M132.5 71l-65 38" stroke="#63858a" />
        <text x="164" y="108" fill="#fff">
          X
        </text>
        <text x="54" y="120" fill="#fff">
          Y
        </text>
        <text x="106" y="25" fill="#fff">
          Z
        </text>
        <line
          x1="100"
          y1="90"
          x2="165"
          y2="90"
          className="lab-bloch-vector"
          style={{
            transformOrigin: "100px 90px",
            transform: `rotate(${Math.atan2(blochPoint.y, blochPoint.x)}rad) scaleX(${Math.hypot(blochPoint.x, blochPoint.y) / 65})`,
          }}
          stroke="#ffb13d"
          strokeWidth="4"
        />
        <circle
          cx="100"
          cy="90"
          className="lab-bloch-vector"
          style={{
            transform: `translate(${blochPoint.x}px, ${blochPoint.y}px)`,
          }}
          r="5"
          fill="#ffb13d"
        />
      </svg>
      <p className="text-sm">
        <span className="block font-mono">
          X {Number(bloch.x.toFixed(3)).toFixed(3)} · Y{" "}
          {Number(bloch.y.toFixed(3)).toFixed(3)} · Z{" "}
          {Number(bloch.z.toFixed(3)).toFixed(3)}
        </span>
        {t(explanation)}
      </p>
    </div>
  );
}
