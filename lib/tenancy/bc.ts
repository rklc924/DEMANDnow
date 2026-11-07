import type { TenancyRules } from "./types";

// BC landlord rules pack. Residential tenancies: Residential Tenancy Act (RTA) and the Residential Tenancy
// Branch (RTB). Commercial leases: Commercial Tenancy Act, Rent Distress Act and the lease, with the debt
// claim routed like any other BC debt (CRT under $5,000, Small Claims to $35,000, lawyer above).
//
// RTB forms and steps checked against gov.bc.ca on 2026-11-07: tenancy forms list (updated 2026-09-03),
// the direct request process and "complete and serve the direct request application" (2026-03-04),
// types of evictions (2026-04-28), serving and enforcing orders (2026-03-04), serving the Notice of Dispute
// Resolution Proceeding (2026-03-04), and fees (2026-03-04).
// Items marked verify were not confirmed on those pages (statutory periods taken from the RTA itself) and
// need a lawyer's check before launch. No firm precedent covers landlord and tenant work, so the wording
// here is our own.

const FORMS_PAGE = "https://www2.gov.bc.ca/gov/content/housing-tenancy/residential-tenancies/calculators-and-resources/tenancy-forms";
const DIRECT_REQUEST = "https://www2.gov.bc.ca/gov/content/housing-tenancy/residential-tenancies/solving-problems/tenancy-dispute-resolution/direct-request-process";

/** RTB application filing fee (gov.bc.ca fees page, 2026-03-04). */
export const RTB_FILING_FEE = 100;

export const BC_TENANCY: TenancyRules = {
  code: "BC",
  name: "British Columbia",
  disclaimer:
    "This is legal information about BC residential and commercial tenancy procedure, not legal advice about your tenancy. For advice, use Request lawyer review.",
  residential: {
    tribunal: "Residential Tenancy Branch",
    tribunalShort: "RTB",
    // RTA s. 90 (deemed receipt): in person the same day; attached to the door or left in the mail slot,
    // the 3rd day; mail, the 5th day; email, the 3rd day. The RTB's own service page confirms these for the
    // dispute resolution package.
    deemedDays: { "in-person": 0, adult: 0, door: 3, "mail-slot": 3, "registered-mail": 5, email: 3 },
    methodLabel: {
      "in-person": "Handed to the tenant in person",
      adult: "Handed to an adult who lives with the tenant",
      door: "Attached to the door or another obvious place at the unit",
      "mail-slot": "Put in the tenant's mailbox or mail slot",
      "registered-mail": "Registered mail to the tenant's address",
      email: "Email (the tenant agreed in writing to email service)",
    },
    payOrDisputeDays: 5,
    noticeDays: 10,
    utilitiesDemandDays: 30,
    packageServeDays: 3,
    filingFee: RTB_FILING_FEE,
    depositDays: 15,
    limitationYears: 2,
    maxLateFee: 25,
    forms: {
      "RTB-30": { code: "RTB-30", title: "10 Day Notice to End Tenancy for Unpaid Rent or Utilities", use: "The notice you serve on the tenant. It must be on the RTB's own form.", url: FORMS_PAGE },
      "RTB-34": { code: "RTB-34", title: "Proof of Service Notice to End Tenancy and Written Demand to Pay Utilities", use: "Records how and when you served the 10 Day Notice (and any utilities demand).", url: FORMS_PAGE },
      "RTB-46": { code: "RTB-46", title: "Landlord Direct Request Worksheet", use: "Lists every rent and utility amount owing and paid. Required for a monetary order.", url: FORMS_PAGE },
      "RTB-12L-DR": { code: "RTB-12L-DR", title: "Landlord Application for Dispute Resolution: Direct Request", use: "The application for an order of possession and a monetary order without a hearing. Most landlords apply online instead of on paper.", url: DIRECT_REQUEST },
      "RTB-44": { code: "RTB-44", title: "Landlord's Proof of Service Direct Request Proceeding", use: "Records how and when you served the Direct Request package on each tenant.", url: FORMS_PAGE },
      "RTB-12L-CT": { code: "RTB-12L-CT", title: "Landlord's Application for Dispute Resolution (Current Tenancy)", use: "For a participatory hearing instead of a Direct Request, for example if the tenant disputed the notice.", url: FORMS_PAGE },
      "RTB-12L-PT": { code: "RTB-12L-PT", title: "Landlord Application for Dispute Resolution (Past Tenancy)", use: "For unpaid rent after the tenant has moved out.", url: FORMS_PAGE },
      "RTB-55": { code: "RTB-55", title: "Proof of Service Notice of Dispute Resolution Proceeding", use: "Proof of service for a participatory hearing package.", url: FORMS_PAGE },
      "RTB-13": { code: "RTB-13", title: "Application for Substituted Service", use: "If you can't serve the tenant by any of the usual methods.", url: FORMS_PAGE },
      "RTB-51": { code: "RTB-51", title: "Address for Service", use: "Where a tenant gives an email address for service in writing.", url: FORMS_PAGE },
      "RTB-21": { code: "RTB-21", title: "Confirmation of Service of Monetary Order for Enforcement in Provincial Court", use: "Filed with the monetary order when you enforce it in Small Claims.", url: FORMS_PAGE },
    },
    steps: [
      {
        id: "ledger",
        title: "Record the rent owing and every payment",
        detail: "Enter each month's rent, any unpaid utilities, and every payment with its date. This becomes your rent ledger and the Direct Request Worksheet (RTB-46). Don't add late fees unless your tenancy agreement allows one.",
      },
      {
        id: "reminder",
        title: "Send a rent demand letter (optional)",
        detail: "A written demand is not required before a 10 Day Notice, but it often gets rent paid and gives you a clear record. It is not a notice to end the tenancy.",
        upload: { label: "Proof the rent demand was delivered", optional: true, requirements: ["Shows the demand was sent to the tenant named on the tenancy agreement", "Shows a sent or delivery date"] },
      },
      {
        id: "utilities",
        title: "Unpaid utilities: give a written demand and wait 30 days",
        detail: "If the tenancy agreement makes the tenant pay utilities to you, give the tenant a written demand with copies of the bills. Utilities can go on the 10 Day Notice only if they are still unpaid 30 days after the demand. Skip this step if only rent is owing.",
      },
      {
        id: "notice",
        title: "Prepare the 10 Day Notice to End Tenancy (RTB-30)",
        detail: "Use the RTB's own form, filled in from the details on this page: every tenant's name, the full rental unit address, the rent owing and the date it was due, any utilities owing and the date of the written demand, the effective date, and your name, address for service and signature.",
        document: "RTB-30 data sheet",
        upload: {
          label: "Your signed 10 Day Notice (RTB-30)",
          requirements: [
            "Is the RTB's 10 Day Notice to End Tenancy for Unpaid Rent or Utilities (RTB-30)",
            "Names every tenant on the tenancy agreement",
            "Gives the full rental unit address, including the unit number",
            "States the rent owing and the date it was due, matching the rent ledger",
            "Any utilities claimed were demanded in writing at least 30 days before",
            "Gives an effective date at least 10 days after the tenant will receive it",
            "Is signed and dated by the landlord or agent, with an address for service",
            "Includes every page of the form",
          ],
        },
      },
      {
        id: "serve-notice",
        title: "Serve the 10 Day Notice and complete the Proof of Service (RTB-34)",
        detail: "Hand it to the tenant, hand it to an adult who lives with them, attach it to the door, put it in their mailbox or mail slot, send it by registered mail, or email it if they agreed in writing. Fill in the RTB-34 right away. Having a witness sign is strongly recommended.",
        document: "RTB-34 data sheet",
        upload: {
          label: "Your completed Proof of Service (RTB-34), or the registered mail receipt",
          requirements: [
            "Is the RTB-34 Proof of Service, a registered mail receipt with tracking number, or a receipt signed by the tenant",
            "Shows the date and method of service",
            "Names the tenant served and the address",
            "Is signed by the person who served it (and a witness, if one was used)",
          ],
        },
      },
      {
        id: "wait",
        title: "Wait 5 days for the tenant to pay in full or dispute",
        detail: "The tenant has 5 days after receiving the notice to pay everything owing (which cancels the notice) or to apply to dispute it. If you accept partial payment, give a receipt that says it is for use and occupancy only and that the notice still stands, so you don't reinstate the tenancy.",
        verify: true,
      },
      {
        id: "apply",
        title: "Apply for a Direct Request (RTB-12L-DR) with the worksheet (RTB-46)",
        detail: "If the tenant didn't pay in full or dispute within 5 days, apply online for an order of possession and a monetary order for the unpaid rent and the filing fee. Upload a copy of the 10 Day Notice, the Proof of Service, the Direct Request Worksheet, the tenancy agreement with any addenda, and any Notices of Rent Increase. If the tenant disputed, the RTB will hold a hearing instead.",
        document: "RTB-12L-DR and RTB-46 data sheets",
        upload: {
          label: "RTB confirmation, or the Notice of Dispute Resolution Proceeding package",
          requirements: [
            "Is from the Residential Tenancy Branch and shows a file number",
            "Names the landlord and every tenant as on the tenancy agreement",
            "Shows the rental unit address",
            "Claims an order of possession and a monetary order matching the rent ledger",
          ],
        },
      },
      {
        id: "serve-package",
        title: "Serve the Direct Request package within 3 days (RTB-44)",
        detail: "Once the RTB makes the Notice of Dispute Resolution Proceeding package available, serve it on each tenant within 3 days, with copies of everything you submitted. Then complete the Landlord's Proof of Service (RTB-44) and upload it to the RTB.",
        document: "RTB-44 data sheet",
        upload: {
          label: "Your completed Proof of Service Direct Request Proceeding (RTB-44)",
          requirements: [
            "Is the RTB-44 Landlord's Proof of Service Direct Request Proceeding",
            "Shows the RTB file number",
            "Shows service on each tenant, with date and method",
            "Service date is within 3 days of the package becoming available",
            "Is signed by the person who served it",
          ],
        },
      },
      {
        id: "decision",
        title: "Get the decision: order of possession and monetary order",
        detail: "An adjudicator decides on the documents, without a hearing. If anything is missing or unclear, the RTB may dismiss the application or set a hearing.",
        upload: {
          label: "The RTB decision and orders",
          requirements: ["Is an RTB decision or order", "Shows the file number and the date", "Names the landlord and tenants", "Shows the order of possession date and the monetary order amount, if granted"],
        },
      },
      {
        id: "serve-orders",
        title: "Serve the orders on the tenant",
        detail: "The RTB doesn't serve or enforce its orders. Serve the order of possession and the monetary order on each tenant and keep proof.",
      },
      {
        id: "possession",
        title: "If the tenant doesn't leave: writ of possession and a court bailiff",
        detail: "File the order of possession in the BC Supreme Court registry and apply for a writ of possession. Only a court bailiff can remove the tenant. Never change the locks, remove belongings or cut services yourself.",
        verify: true,
      },
      {
        id: "collect",
        title: "Collect the monetary order through Small Claims",
        detail: "File the monetary order in the Provincial Court (Small Claims) registry with the Confirmation of Service (RTB-21). Then use payment hearings and garnishment, the same tools as any Small Claims judgment.",
        verify: true,
      },
      {
        id: "deposit",
        title: "When the tenancy ends: deal with the security deposit",
        detail: "Within 15 days after the later of the day the tenancy ends and the day you get the tenant's forwarding address in writing, either return the deposits or apply to the RTB to keep them against the unpaid rent (unless the tenant agreed in writing). Missing this can mean paying back double.",
        verify: true,
      },
    ],
    links: [
      { label: "RTB: tenancy forms", url: FORMS_PAGE },
      { label: "RTB: the direct request process", url: DIRECT_REQUEST },
      { label: "RTB: apply online (Online Application for Dispute Resolution)", url: "https://tenancydispute.gov.bc.ca/intake/login" },
      { label: "RTB: serving and enforcing orders", url: "https://www2.gov.bc.ca/gov/content/housing-tenancy/residential-tenancies/solving-problems/tenancy-dispute-resolution/serving-and-enforcing-orders" },
      { label: "Residential Tenancy Act", url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/02078_01" },
    ],
  },
  commercial: {
    defaultGraceDays: 15,
    remedies: [
      {
        id: "sue",
        title: "Sue for the arrears and keep the lease going",
        detail: "Claim the rent owing from the tenant and any indemnifier. The lease continues. The claim goes to the Civil Resolution Tribunal under $5,000 or Small Claims up to $35,000. Above that, we refer it to a lawyer.",
      },
      {
        id: "distress",
        title: "Distress: have a bailiff seize the tenant's goods",
        detail: "A licensed bailiff seizes and sells the tenant's goods on the premises to pay the arrears, under the Rent Distress Act. The lease continues. You can't end the lease by re-entry while relying on distress for the same rent, and some goods are exempt.",
        verify: true,
      },
      {
        id: "reentry",
        title: "End the lease by re-entry (lock-out)",
        detail: "If the lease allows it and rent has been unpaid for the period it sets (often 15 days), you can retake the premises, usually through a bailiff, which ends the lease. You then sue for the arrears and lost rent. The tenant can ask the court for relief from forfeiture, and once you re-enter you can no longer distrain.",
        verify: true,
      },
    ],
    steps: [
      {
        id: "ledger",
        title: "Record the rent owing and every payment",
        detail: "Enter base rent, additional rent (operating costs, taxes) and any other charges the lease makes payable as rent, and every payment with its date.",
      },
      {
        id: "lease",
        title: "Check the lease",
        detail: "Find the rent clause, the default and re-entry clause (how many days rent must be unpaid), interest on arrears, any indemnifier or guarantor, the security deposit, and the address for notices.",
        upload: {
          label: "The signed lease",
          requirements: ["Is a signed commercial lease", "Names the landlord and tenant", "Shows the rent and when it is due", "Shows any indemnifier or guarantor"],
        },
      },
      {
        id: "demand",
        title: "Send the rent demand letter to the tenant and any indemnifier",
        detail: "The software generates the letter from your rent ledger. Send it to the address for notices in the lease, and to each indemnifier.",
        upload: { label: "Proof the demand was delivered", requirements: ["Shows the demand was sent to the tenant named in the lease", "Shows a sent or delivery date", "Delivery date is on or after the demand letter date"] },
      },
      {
        id: "remedy",
        title: "Choose one remedy: sue, distress or re-entry",
        detail: "These can't all be combined. Distress keeps the lease alive. Re-entry ends it. Pick one before acting, and request lawyer review before a lock-out or distress.",
        verify: true,
      },
      {
        id: "deposit",
        title: "Apply the security deposit if the lease allows",
        detail: "Most leases let the landlord apply the deposit to arrears and require the tenant to top it up. Tell the tenant in writing.",
      },
      {
        id: "claim",
        title: "Start the claim for the arrears",
        detail: "Under $5,000 the claim starts at the Civil Resolution Tribunal. From $5,000 to $35,000 it goes to Small Claims (Provincial Court). Name the tenant and every indemnifier by their exact legal names. Over $35,000, we refer the file to a lawyer.",
        upload: { label: "Your filed claim (CRT Dispute Notice or Small Claims Notice of Claim)", requirements: ["Is a CRT Dispute Notice or a Small Claims Notice of Claim", "Shows a file number", "Names the tenant (and indemnifiers) by their legal names", "Amount claimed matches the rent ledger and is within the forum's limit"] },
      },
      {
        id: "overholding",
        title: "If the tenant won't leave after the lease ends: lawyer hand-off",
        detail: "A tenant who stays after the lease ends is overholding. Getting possession back goes through the BC Supreme Court under the Commercial Tenancy Act. Send the file for lawyer review.",
        verify: true,
      },
    ],
    links: [
      { label: "Commercial Tenancy Act", url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96057_01" },
      { label: "Rent Distress Act", url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96403_01" },
      { label: "Civil Resolution Tribunal", url: "https://civilresolutionbc.ca/" },
      { label: "BC Government: Small Claims how-to guides", url: "https://www2.gov.bc.ca/gov/content/justice/courthouse-services/small-claims/how-to-guides" },
    ],
  },
};
