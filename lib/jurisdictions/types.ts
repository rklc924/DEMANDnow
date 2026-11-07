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
  /** How to serve the starting document: hire a server at a fixed fee, or serve it yourself. */
  service?: ServiceGuide;
}

export interface ServiceFee {
  id: string;
  area: string;
  price: number | null; // null = quoted
  note?: string;
  /** Bookable online: the job is sent straight to our process server by email and text. */
  dispatch?: boolean;
  /** An extra on top of the area fee, not an area. */
  addOn?: boolean;
}

export interface ServiceGuide {
  document: string;
  /** Fixed-fee process service. placeholder = prices not yet confirmed with a service provider. */
  serverFees: { fees: ServiceFee[]; includes: string; placeholder: boolean; /** Demand Now booking fee added to every job. */ bookingFee: number };
  selfServe: { title: string; detail: string; verify?: boolean }[];
  proof: { document: string; detail: string; verify?: boolean };
  /** Deadlines counted from the date of service. */
  afterService: { label: string; days: number; outsideProvinceDays?: number }[];
  officialGuides: { label: string; url: string }[];
}

export interface EnforcementStep {
  id: string;
  title: string;
  detail: string;
  /** Prescribed form or document the app prepares for this step, if any. */
  document?: string;
  /** Statements we have not yet confirmed against current rules. Shown to users as "confirm". */
  verify?: boolean;
  /** Steps that depend on something outside the app ask the client to upload proof, which is then checked. */
  upload?: StepUpload;
  /** The step's document must be sworn, affirmed or notarized: offers a local partner or a mobile notary/commissioner. */
  witness?: import("../witness").WitnessNeed;
}

export interface StepUpload {
  label: string;
  /** What a compliant document must show. The document check tests each one. */
  requirements: string[];
  optional?: boolean;
}

export interface Jurisdiction {
  code: string;
  name: string;
  limitation: { years: number; note: string };
  forums: Forum[];
  disclaimer: string;
}
