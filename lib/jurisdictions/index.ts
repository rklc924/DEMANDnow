import { BC } from "./bc";
import type { Forum, Jurisdiction } from "./types";

export const JURISDICTIONS: Record<string, Jurisdiction> = { BC };

export function getJurisdiction(code: string): Jurisdiction {
  const j = JURISDICTIONS[code];
  if (!j) throw new Error(`No rules pack for jurisdiction ${code}`);
  return j;
}

/** Forum routing: first forum whose cap covers the principal. Rocky's rule for BC: <$5k CRT, <=$35k Small Claims, else lawyer. */
export function routeForum(j: Jurisdiction, principal: number): Forum {
  return j.forums.find((f) => f.maxClaim === null || principal <= f.maxClaim)!;
}

export function limitationDate(j: Jurisdiction, dueDate: string): Date {
  const d = new Date(dueDate + "T00:00:00");
  d.setFullYear(d.getFullYear() + j.limitation.years);
  return d;
}
