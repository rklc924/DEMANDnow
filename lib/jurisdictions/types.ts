// A jurisdiction "rules pack". Adding Alberta later means adding one file like bc.ts.

export type ForumId = string;

export interface Forum {
  id: ForumId;
  name: string;
  /** Inclusive upper bound in dollars for claims routed here, excluding interest and costs. null = no cap. */
  maxClaim: number | null;
  /** True when the app guides the user through it; false means it is handed to a lawyer. */
  selfServe: boolean;
  summary: string;
  steps: EnforcementStep[];
}

export interface EnforcementStep {
  id: string;
  title: string;
  detail: string;
  /** Prescribed form or document the app prepares for this step, if any. */
  document?: string;
  /** Statements we have not yet confirmed against current rules. Shown to users as "confirm". */
  verify?: boolean;
}

export interface Jurisdiction {
  code: string;
  name: string;
  limitation: { years: number; note: string };
  forums: Forum[];
  disclaimer: string;
}
