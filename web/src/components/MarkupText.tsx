import type { ReactNode } from "react";
import { parseInlineMarkup } from "@app/shared";

/** Renders **bold** / ==highlight== / __underline__ inline markup as styled spans. */
export default function MarkupText({ text }: { text: string }) {
  const runs = parseInlineMarkup(text);
  return (
    <>
      {runs.map((run, i) => {
        let node: ReactNode = run.text;
        if (run.bold) node = <strong>{node}</strong>;
        if (run.highlight) node = <mark>{node}</mark>;
        if (run.underline) node = <u>{node}</u>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}
