import type { AccountingProvider, Customer, Invoice } from "./types";

// Sample ledger so the prototype runs without a live connection. Dates are relative to today.
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const customers: Customer[] = [
  { id: "c1", name: "Fraser Valley Renovations Ltd.", kind: "business", email: "ap@fvreno.example", address: ["1200 - 45 Industrial Way", "Abbotsford, BC  V2T 1A1"] },
  { id: "c2", name: "Kits Point Dental Corp.", kind: "business", email: "office@kitsdental.example", address: ["2101 West 4th Avenue", "Vancouver, BC  V6K 1N7"] },
  { id: "c3", name: "Jordan Lee", kind: "consumer", email: "jordan.lee@example.com", address: ["88 Elm Street", "Burnaby, BC  V5H 2K3"] },
  { id: "c4", name: "Okanagan Orchard Supply Inc.", kind: "business", email: "accounts@oos.example", address: ["300 Harvey Avenue", "Kelowna, BC  V1Y 6C7"] },
  { id: "c5", name: "Harbourview Strata Management", kind: "business", email: "billing@harbourview.example", address: ["900 - 1055 Dunsmuir Street", "Vancouver, BC  V7X 1L3"] },
];

const invoices: Invoice[] = [
  { id: "i1", number: "INV-1041", customerId: "c1", issueDate: daysAgo(160), dueDate: daysAgo(130), amountDue: 18450.0, interestRate: 18, description: "Supply and installation of commercial millwork" },
  { id: "i2", number: "INV-1057", customerId: "c2", issueDate: daysAgo(128), dueDate: daysAgo(98), amountDue: 3275.5, description: "Network cabling and equipment" },
  { id: "i3", number: "INV-1063", customerId: "c3", issueDate: daysAgo(125), dueDate: daysAgo(95), amountDue: 1890.0, description: "Kitchen cabinet refinishing" },
  { id: "i4", number: "INV-1022", customerId: "c4", issueDate: daysAgo(240), dueDate: daysAgo(210), amountDue: 52300.0, interestRate: 24, description: "Irrigation equipment, spring order" },
  { id: "i5", number: "INV-1088", customerId: "c5", issueDate: daysAgo(80), dueDate: daysAgo(50), amountDue: 7420.0, description: "Lobby renovation, phase 1" },
  { id: "i6", number: "INV-1092", customerId: "c1", issueDate: daysAgo(70), dueDate: daysAgo(40), amountDue: 4600.0, interestRate: 18, description: "Change order 3" },
  { id: "i7", number: "INV-1101", customerId: "c2", issueDate: daysAgo(20), dueDate: daysAgo(-10), amountDue: 980.0, description: "Monthly support" },
  { id: "i8", number: "INV-1079", customerId: "c4", issueDate: daysAgo(105), dueDate: daysAgo(75), amountDue: 11200.0, interestRate: 24, description: "Fertilizer injection units" },
];

export const sampleProvider: AccountingProvider = {
  id: "sample",
  label: "Sample ledger",
  async fetchCustomers() { return customers; },
  async fetchOpenInvoices() { return invoices; },
};
