"use client";
import {
  amplitudeText,
  basisStates,
  probsReg,
  type Register,
} from "@/game/register";
import { t, useLocale } from "@/i18n";
const percent = (p: number) => `${Math.round(p * 1000) / 10}%`;
/**
 * Amplitude bars over every basis state: up for +, down for −. Each column
 * prints its amplitude, and the chance of reading it (the amplitude squared)
 * underneath. The dashed line is the average the Diffuser mirrors about.
 * Heights animate between states so each piece's effect is visible.
 */
export function AmplitudeBars({
  amps,
  mean = false,
  highlight,
  title,
  legend = true,
}: {
  amps: Register;
  mean?: boolean;
  highlight?: string;
  title?: string;
  legend?: boolean;
}) {
  useLocale((state) => state.locale);
  const labels = basisStates(Math.log2(amps.length));
  const probs = probsReg(amps);
  const average = amps.reduce((sum, a) => sum + a, 0) / amps.length;
  return (
    <div
      className="amp-bars"
      role="img"
      aria-label={`${t("Ideal amplitude illustration, not measured counts.")} ${title ? `${t(title)}. ` : ""}${t("Amplitudes")}: ${labels.map((label, i) => `|${label}⟩ ${amplitudeText(amps[i])}`).join(", ")}`}
    >
      <div className="amp-head">
        {title && <strong className="text-accent-teal">{t(title)}</strong>}
        {legend && (
          <span className="text-stage-muted">
            {t("Ideal amplitude illustration, not measured counts.")}{" "}
            {t(
              "Bar height = amplitude; below the line means a minus sign. The % is the chance to read that state: the amplitude squared.",
            )}
          </span>
        )}
      </div>
      <div
        className="amp-plot"
        style={{
          gridTemplateColumns: `repeat(${amps.length}, minmax(0, 1fr))`,
        }}
      >
        {amps.map((a, i) => (
          <div
            key={labels[i]}
            className={`amp-col ${highlight === labels[i] ? "marked" : ""}`}
          >
            <div className="amp-half up">
              <span
                className="amp-bar"
                style={{ height: `${Math.max(0, a) * 100}%` }}
              />
            </div>
            <div className="amp-half down">
              <span
                className="amp-bar negative"
                style={{ height: `${Math.max(0, -a) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {mean && (
          <span
            className="amp-mean"
            style={{ top: `${50 - average * 50}%` }}
            aria-hidden="true"
          >
            <span className="amp-mean-tag">
              {t("average")} {amplitudeText(average)}
            </span>
          </span>
        )}
      </div>
      <div
        className="amp-labels"
        style={{
          gridTemplateColumns: `repeat(${amps.length}, minmax(0, 1fr))`,
        }}
      >
        {labels.map((label, i) => (
          <span key={label}>
            <span className="qubit-ket">|{label}⟩</span>
            <strong
              className={
                amps[i] < -1e-6 ? "text-accent-amber" : "text-accent-teal"
              }
            >
              {amplitudeText(amps[i])}
            </strong>
            <span className="text-stage-muted">{percent(probs[i])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
