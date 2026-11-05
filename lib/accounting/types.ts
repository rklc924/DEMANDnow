// Normalized shape every accounting connector returns. The unified API (Merge/Codat/Rutter)
// maps QuickBooks, Xero, FreshBooks, Sage and NetSuite into this.

export interface Customer {
  id: string;
  name: string;
  kind: "business" | "consumer";
  email: string;
  address: string[]; // mailing lines
  /** Name as it appears in the accounting system, when a confirmed legal name replaces it. */
  invoiceName?: string;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;
  amountDue: number; // CAD, outstanding balance
  /** Contractual annual interest rate on overdue amounts, if the invoice terms state one. */
  interestRate?: number;
  description: string;
}

export interface AccountingProvider {
  id: string;
  label: string;
  fetchCustomers(): Promise<Customer[]>;
  fetchOpenInvoices(): Promise<Invoice[]>;
}
