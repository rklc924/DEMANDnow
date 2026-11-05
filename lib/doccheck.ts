import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import type { StepUpload } from "./jurisdictions/types";
import type { DocCheck } from "./store";

// Checks an uploaded court or service document against the step's requirements and the matter's facts.
// With ANTHROPIC_API_KEY set, Claude reads the PDF or image and tests each requirement. Without it, only
// basic file checks run and the document is marked "unchecked".

export interface MatterFacts {
  claimant: string;
  defendant: string;
  amountOwing: string;
  invoiceNumber: string;
  demandLetterDate?: string;
  forum: string;
}

const MAX_BYTES = 20 * 1024 * 1024;
const MODEL = "claude-opus-5-5";

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "checks"],
  properties: {
    summary: { type: "string", description: "One or two plain-English sentences for the client about this document." },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirement", "result", "note"],
        properties: {
          requirement: { type: "string" },
          result: { type: "string", enum: ["met", "not_met", "unclear"] },
          note: { type: "string", description: "What in the document shows this, or exactly what is wrong or missing and how to fix it." },
        },
      },
    },
  },
} as const;

const SYSTEM = `You check documents that a business owner has uploaded while collecting a debt in British Columbia, Canada.
For each requirement, decide whether the document meets it: "met", "not_met", or "unclear" (unreadable, missing page, or can't tell).
Compare names, amounts and dates against the matter facts. A small spelling difference in a party's legal name is "not_met".
Write notes for a non-lawyer: say what you saw, and for a problem, what to fix. Do not give legal advice beyond the listed requirements.
Return one entry per requirement, in the order given, with the requirement text copied exactly.`;

async function basicIssues(bytes: Uint8Array, mime: string): Promise<string[]> {
  const issues: string[] = [];
  if (bytes.length === 0) issues.push("The file is empty.");
  if (bytes.length > MAX_BYTES) issues.push("The file is over 20 MB. Upload a smaller scan.");
  if (!["application/pdf", "image/png", "image/jpeg"].includes(mime)) issues.push("Upload a PDF, PNG or JPG.");
  if (mime === "application/pdf" && bytes.length) {
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (pdf.getPageCount() === 0) issues.push("The PDF has no pages.");
    } catch {
      issues.push("The PDF couldn't be opened. It may be damaged or password-protected.");
    }
  }
  return issues;
}

export async function checkDocument(
  input: { bytes: Uint8Array; mime: string; name: string },
  upload: StepUpload,
  facts: MatterFacts,
): Promise<Pick<DocCheck, "status" | "summary" | "checks">> {
  const basic = await basicIssues(input.bytes, input.mime);
  if (basic.length) {
    return {
      status: "issues",
      summary: "This file can't be checked.",
      checks: basic.map((b) => ({ requirement: "Readable PDF or image", result: "not_met" as const, note: b })),
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: "unchecked",
      summary: "Saved. Automatic document checking isn't switched on yet, so review it against the list yourself.",
      checks: upload.requirements.map((r) => ({ requirement: r, result: "unclear" as const, note: "Not checked automatically." })),
    };
  }

  const data = Buffer.from(input.bytes).toString("base64");
  const file: Anthropic.ContentBlockParam =
    input.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: input.mime as "image/png" | "image/jpeg", data } };

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: RESULT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            file,
            {
              type: "text",
              text: `Document: ${upload.label} (file "${input.name}")

Matter facts:
- Claimant (creditor): ${facts.claimant}
- Defendant (debtor): ${facts.defendant}
- Amount owing: ${facts.amountOwing} on invoice ${facts.invoiceNumber}
- Forum: ${facts.forum}${facts.demandLetterDate ? `\n- Demand letter dated: ${facts.demandLetterDate}` : ""}

Requirements:
${upload.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
            },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal") throw new Error("The document checker declined this file.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = JSON.parse(text) as Pick<DocCheck, "summary" | "checks">;
    const ok = parsed.checks.length > 0 && parsed.checks.every((c) => c.result === "met");
    return { status: ok ? "pass" : "issues", summary: parsed.summary, checks: parsed.checks };
  } catch (e) {
    const msg =
      e instanceof Anthropic.RateLimitError
        ? "The checker is busy. Try the check again in a minute."
        : e instanceof Anthropic.APIError
          ? `The checker is unavailable (${e.status ?? "network"}).`
          : (e as Error).message;
    return {
      status: "unchecked",
      summary: `Saved, but the automatic check didn't run: ${msg}`,
      checks: upload.requirements.map((r) => ({ requirement: r, result: "unclear" as const, note: "Not checked." })),
    };
  }
}
