# Discovery checklist

Use this with the customer before encoding any customer-specific rule. Each checked item should record the answer, who said it, and the date. Then move that rule to **Customer-confirmed** in [requirements.md](./requirements.md) and retire the matching proposed default.

Unchecked items stay **Open**. The reversible default remains in force. Do not fill gaps from the Westshore seed, from `lib/flow.ts`, from `lib/finance.ts`, or from the Canada–US rate confirmation.

Four items are easy to confuse with the prototype. They are **Open** until someone at the customer confirms them:

- Driver pay. The demo flat `$185` / `$95` / `$250`, 27%, and hourly rates are not their rule.
- Load handoffs. The demo import and export chains are not their stages.
- Receipt approval. The demo path from “approved” to a reimbursement ledger line is not their policy.
- Container empty returns. The demo step that keeps an import open until the empty is back is not their requirement.

The first workflow can still upload a receipt and a POD and record an owner review. That capability does not answer those four. Driver-pay calculations stay disabled until the three examples below are filed. No pay-formula table executes. Typed amounts only.

The eight owner questions in [owner-questions.md](./owner-questions.md) are the reason these answers matter. M1 in [m1-plan.md](./m1-plan.md) is a technical workflow checkpoint, not a live pilot. It does not wait on the financial and paperwork items, and it does not close the pre-pilot gates: load completion, cancellation, handoffs/stage machine, and container empty returns. Driver-pay calculations stay disabled until the three examples below are customer-confirmed.

## Freight type

- [ ] Port containers, dry van, or both? (Q1)
- [ ] If both, what on the order tells the office which one a load is?
- [ ] Which identifier do dispatchers actually say out loud: container, booking, PRO, BOL, or their own load number?
- [ ] Bring one redacted order of each type they run.

## How orders arrive

- [ ] Phone, email, portal, spreadsheet, or a broker site? List every path they use in a normal week. (Q2)
- [ ] Who may create a load in the pilot? (Q13)
- [ ] Collect two or three redacted examples that show the fields they copy today, including anything they write in the margin.

## Milestones, handoffs, and done

**Open** until checked. Do not copy `IMPORT_FLOW` or `EXPORT_FLOW`.

- [ ] List the stages they track, in order, for each freight type they actually run. (Q3)
- [ ] Who is allowed to move a stage: driver, owner, or either?
- [ ] What does the driver do to accept a dispatch? Does the pitch “Accept Load” step match that gesture? (Q17)
- [ ] When is the job complete? Delivery, empty back at the terminal, paperwork in, or customer paid?
- [ ] Is a container empty return a required handoff, a deadline, or not part of their work? What clears it? (Q3, Q18)
- [ ] What counts as “holding it up,” and which reason codes do they already use? (owner question 2)

## Driver pay

**Open** until three real examples are filed. Until then, driver-pay calculations stay disabled: typed amounts may be stored, and no pay-formula table executes. (Q4)

- [ ] Example A, with the source document (settlement line, text, or spreadsheet row).
- [ ] Example B, a different shape if they have one (hourly, percentage, flat, per stop, layover).
- [ ] Example C, including any accessorial the first two did not show.
- [ ] Do earnings wait for the customer’s payment, or do they post when the move is done?
- [ ] Advances, deductions, and who may enter an adjustment.

Leave pitch numbers out of the notes. `$185`, `$95`, `$250`, 27%, `$34`, and `$36` are demo profiles.

## Expenses and receipt approval

**Open.** The workflow can store a receipt and an owner decision of approved or rejected. Do not treat that as their reimbursement policy. (Q5)

- [ ] Which categories exist, and which ones a driver may submit? (Q5)
- [ ] What requires a receipt, and what is an acceptable “receipt missing” reason?
- [ ] Who approves? What does a rejection do? What does “needs correction” do?
- [ ] Is a driver-paid approved expense always reimbursed, or only when they ask?
- [ ] Company card or company cash: recorded on the load, and never added to the driver’s balance?

## Documents and customer billing

- [ ] For a finished job, which files are required, and which are optional? (Q6)
- [ ] Who reviews them, and how long are they kept? (Q15)
- [ ] Does a shipper or broker ever get a login? (Q15)
- [ ] What does “billing” mean: invoices inside SnapDispatch, or a spreadsheet / accounting export the office already sends?
- [ ] If they invoice, what makes a load billable, what are the payment terms, and where do receipts from the customer get recorded? (owner question 6)

## Tools they already use

- [ ] GPS or ELD vendor, if any. Do they want coordinates in this product, or is the driver’s reported stage enough? (Q7)
- [ ] The spreadsheet or accounting file an export must line up with. Attach a redacted copy. Name the columns that have to match.
- [ ] Where truck maintenance is tracked today. (owner question 7)
- [ ] Where driver balances are tracked today. (owner question 5)

## People, phones, and connectivity

- [ ] Names of the office people who will sign in during the pilot, and whether any of them are not the owner. (Q8, Q10)
- [ ] How a driver proves who they are: email, password, or phone OTP.
- [ ] Personal phones, or a tablet shared in the truck?
- [ ] Does the terminal or the yard lose signal often enough that a status must be saved offline? (Q8)
- [ ] Is Spanish required on the driver phone on day one? (Q14)
- [ ] Which IANA timezone should their organization use for input, display, and the business day? Storage is UTC either way. (Q11)

## Records to bring over

- [ ] Active drivers, trucks, and customers for the pilot week. (Q9, Q13)
- [ ] Open loads that must appear on day one, separate from historical loads.
- [ ] Opening amount owed to each driver, with the source of the number. If they cannot produce it, start at zero and say so.
- [ ] Opening amount each customer still owes, only if Q6 puts receivables in this product.
- [ ] Trucks that are out of service on day one.

## Assignment rules

- [ ] Can one driver or one truck hold two open loads the same day? (Q12)
- [ ] Is an overlapping appointment a hard stop?
- [ ] Does an overdue service hard-block dispatch, or only an out-of-service flag?

## Day one and the pilot

- [ ] The smallest set that must work on the first real morning. (Q10)
- [ ] Named drivers and the owner who will use it that week.
- [ ] Beside the current dispatch sheet, or in place of it? (Q16)
- [ ] The person who may fix a stuck load during the pilot.
- [ ] Which of the eight owner questions they expect to answer in week one, and which can wait.

## Done when

- [ ] Q4’s three pay examples are filed before any earning formula is coded. Until then D13 stays in force.
- [ ] Q3 and Q17 are answered before a required stage list replaces free progress notes. Empty return stays optional until they say otherwise.
- [ ] Q5 is answered before an approved receipt posts money.
- [ ] Q6 is answered before any invoice table or “this document is required” rule is added.
- [ ] Q7 is answered before any GPS vendor or spreadsheet import is added.
- [ ] The answers are written into [requirements.md](./requirements.md) with the date and the person who confirmed them.
