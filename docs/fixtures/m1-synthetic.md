# Synthetic M1 fixture

[m1-synthetic.json](./m1-synthetic.json) is a fake company for staging tests of the first workflow. It is not Westshore Drayage and it is not the customer. Do not load it into the pitch site or into a database that holds real freight.

The loader must refuse to run unless the target is marked staging and the organization name starts with `Synthetic`.

## What it contains

- One organization, `Synthetic Staging Carrier`, with `syntheticOnly: true`.
- `displayTimezone` set to `America/Los_Angeles` so business-day tests have a zone. That value is fixture configuration. It is not a customer-confirmed zone. Stored event times in the script are UTC.
- One owner and two drivers, on separate logins.
- Truck `SYN-01` in service, truck `SYN-02` out of service, and driver `Synthetic Driver Off` with availability `off`.
- One customer, two places, and load `SYN-LOAD-001` with no container number and no customer rate.
- `payRules` is `null`. `emptyReturnRequired` is `null`.

Emails use `synthetic.example`. No phone number is a real subscriber line.

## Script the acceptance test follows

1. Owner creates `SYN-LOAD-001` if the row is not already present.
2. Owner assigns `Synthetic Driver One` and `SYN-01`.
3. Driver One, on another session, reads the load and acknowledges.
4. Driver One posts the progress note in `workflowScript`. The note does not mention an empty return. That must succeed.
5. Driver One uploads the receipt (`amountCents` 1234) and the POD described in the file. 1234 cents is a typed test amount, not a tariff and not a reimbursement rule.
6. Owner approves the POD and rejects the receipt with the note in the file. The receipt amount stays 1234. No ledger row appears.

Negative cases in the same file:

- Assign `SYN-02` and expect `truck_out_of_service`.
- Assign `Synthetic Driver Off` and expect `driver_unavailable`.
- `SYN-LOAD-002` overlaps `SYN-LOAD-001` on Driver One and `SYN-01`. Assigning it as well expects `appointment_overlap`.
- Driver Two reads `SYN-LOAD-001` and expects 404.

## Pay and empty return

Do not add `18500`, `9500`, `25000`, or `27` to this file to “make the numbers look real.” Those are pitch rates. Do not add a required `empty_returned` event. Both are **Open** in [requirements.md](../requirements.md).
