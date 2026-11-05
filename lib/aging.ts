export type Bucket = "current" | "1-30" | "31-60" | "61-90" | "90+";
export const BUCKETS: Bucket[] = ["current", "1-30", "31-60", "61-90", "90+"];

export function daysOverdue(dueDate: string, today = new Date()): number {
  const due = new Date(dueDate + "T00:00:00");
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

export function bucketFor(days: number): Bucket {
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
