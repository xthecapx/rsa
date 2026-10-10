"use client";
import { useState } from "react";
import {
  CAMPUS_EXHIBITS,
  CAMPUS_NOTEBOOK_ENTRIES,
  type CampusExhibitId,
} from "@/content/campus";
import { t, useLocale } from "@/i18n";
/** Read-only help can be embedded in any laptop without travel or execution. */
export function CampusNotebook({
  onOpen,
}: {
  onOpen?: (id: CampusExhibitId) => void;
}) {
  useLocale((s) => s.locale);
  const [search, setSearch] = useState("");
  const query = search.toLocaleLowerCase();
  const entries = [
    ...CAMPUS_EXHIBITS.map((e) => ({
      id: e.id,
      title: e.title,
      text: e.explain,
      math: e.math,
    })),
    ...CAMPUS_NOTEBOOK_ENTRIES.map((e) => ({
      id: null,
      title: e.title,
      text: e.text,
      math: "",
    })),
  ];
  const shown = entries.filter((e) =>
    `${t(e.title)} ${t(e.text)} ${t(e.math)}`
      .toLocaleLowerCase()
      .includes(query),
  );
  return (
    <section className="space-y-4 font-body">
      <h3 className="text-accent-teal">{t("Campus field notebook")}</h3>
      <label className="block">
        {t("Search concepts")}
        <input
          type="search"
          className="mt-2 block w-full rounded border border-stage-border bg-stage-bg p-3 text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {!shown.length && (
        <p role="status">{t("No matching entry. Try another word.")}</p>
      )}
      {shown.map((e) => (
        <details className="panel p-3" key={e.title}>
          <summary className="cursor-pointer text-accent-amber">
            {t(e.title)}
          </summary>
          <p className="mt-3 leading-relaxed">{t(e.text)}</p>
          {e.math && (
            <p className="mt-3 text-sm text-stage-muted">{t(e.math)}</p>
          )}
          {onOpen && e.id && (
            <button className="btn-ghost mt-3" onClick={() => onOpen(e.id!)}>
              {t("Open exhibit")}
            </button>
          )}
        </details>
      ))}
    </section>
  );
}
export function CampusReference() {
  return (
    <details className="panel mt-4 p-3">
      <summary className="cursor-pointer text-accent-teal">
        {t("Quantum questions? Open the field notebook")}
      </summary>
      <div className="mt-4">
        <CampusNotebook />
      </div>
    </details>
  );
}
