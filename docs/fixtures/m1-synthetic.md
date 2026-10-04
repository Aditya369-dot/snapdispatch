# Synthetic M1 fixtures

Three staging files. None of them is Westshore Drayage, and none of them is the customer. Do not load them into the pitch site or into a database that holds real freight.

The loader refuses `SNAPDISPATCH_ENV=production` and any value other than `development`, `test`, or `staging`. It also refuses an organization that is not synthetic or whose name does not start with `Synthetic`. On staging it refuses an empty fixture password, a password shorter than 16 characters, and the local development default. See [SETUP.md](../SETUP.md).

M1 is a technical workflow checkpoint, not a live pilot. Driver-pay calculations are disabled in every file: `payRules` is `null`, no pay-formula table is represented, and amounts that appear are typed test amounts only. `emptyReturnRequired` is `null`.

| File | Scenario | What to prove |
| --- | --- | --- |
| [m1-synthetic.json](./m1-synthetic.json) | Minimal roster | The checkpoint path on one small company. Acceptance checks 1–19 in [m1-plan.md](../m1-plan.md). |
| [m1-fleet.json](./m1-fleet.json) | Larger fleet | At least 10 trucks, matching first-customer scale. Checks 20–22. |
| [m1-isolation.json](./m1-isolation.json) | Second organization | Company isolation between two synthetic orgs. Checks 23–25. |

Fixture timezones are test configuration so business-day tests have an IANA zone. They are not a customer-confirmed zone. Stored event times in the scripts are UTC.

Emails use `synthetic.example`. No phone number is a real subscriber line.

## Minimal roster

[m1-synthetic.json](./m1-synthetic.json) stays the small path.

- One organization, `Synthetic Staging Carrier`, with `syntheticOnly: true`.
- `displayTimezone` set to `America/Los_Angeles`.
- One owner and two drivers, on separate logins.
- Truck `SYN-01` in service, truck `SYN-02` out of service, and driver `Synthetic Driver Off` with availability `off`.
- One customer, two places, and load `SYN-LOAD-001` with no container number and no customer rate.
- `payRules` is `null`. `emptyReturnRequired` is `null`.

### Script the minimal acceptance test follows

1. Owner creates `SYN-LOAD-001` if the row is not already present.
2. Owner assigns `Synthetic Driver One` and `SYN-01`.
3. Driver One, on another session, reads the load and acknowledges.
4. Driver One posts the progress note in `workflowScript`. The note does not mention an empty return. That must succeed.
5. Driver One uploads the receipt (`amountCents` 1234) and the POD described in the file. 1234 cents is a typed test amount, not a tariff, not a pay formula, and not a reimbursement rule.
6. Owner approves the POD and rejects the receipt with the note in the file. The receipt amount stays 1234. No ledger row appears. No pay formula runs.

Negative cases in the same file:

- Assign `SYN-02` and expect `truck_out_of_service`.
- Assign `Synthetic Driver Off` and expect `driver_unavailable`.
- `SYN-LOAD-002` overlaps `SYN-LOAD-001` on Driver One and `SYN-01`. Assigning it as well expects `appointment_overlap`.
- Driver Two reads `SYN-LOAD-001` and expects 404.

## Larger fleet

[m1-fleet.json](./m1-fleet.json) is a second scenario, loaded in addition to the minimal roster. It does not replace it.

- One organization, `Synthetic Fleet Carrier`, with `syntheticOnly: true`.
- `displayTimezone` set to `America/Chicago` as fixture configuration.
- One owner, ten available drivers (`Synthetic Fleet Driver 01` through `10`), and `Synthetic Fleet Driver Off`.
- Twelve trucks, `SYN-F01` through `SYN-F12`. `SYN-F01` through `SYN-F11` are in service. `SYN-F12` is out of service. Twelve is the first-customer scale floor of at least 10 trucks, plus one out-of-service unit.
- Two customers, four places, and loads `SYN-FLEET-001` (the workflow load), `SYN-FLEET-002` (a second same-day load on another driver and truck), and `SYN-FLEET-003` (an overlap case against `SYN-FLEET-001`).
- `payRules` is `null` on the file and on every driver. `emptyReturnRequired` is `null`. No customer rate is set.

### Script the fleet checks follow

1. The owner lists trucks and sees all twelve units.
2. Owner assigns `Synthetic Fleet Driver 01` and `SYN-F01` to `SYN-FLEET-001`, then that driver acknowledges, posts the progress note, uploads the typed receipt (`amountCents` 2400) and the POD, and the owner reviews them. 2400 cents is a typed test amount. Review does not change it and does not execute a pay formula.
3. Assign `SYN-F12` and expect `truck_out_of_service`.
4. Assign `Synthetic Fleet Driver Off` and expect `driver_unavailable`.

`SYN-FLEET-002` exists so the roster is not a single load. It is not a second pay scenario.

## Second organization

[m1-isolation.json](./m1-isolation.json) loads two organizations for company-isolation tests. This is not a decision to onboard a second carrier. Proposed default D1 is still one company per pilot database. The second organization exists so a session in one company cannot read or write the other.

| Key | Name | Truck | Load | Fixture timezone |
| --- | --- | --- | --- | --- |
| `alpha` | `Synthetic Isolation Alpha` | `SYN-A-01` | `SYN-ISO-A-001` | `America/Denver` |
| `bravo` | `Synthetic Isolation Bravo` | `SYN-B-01` | `SYN-ISO-B-001` | `America/New_York` |

Each organization has its own owner, one available driver, one in-service truck, one customer, two places, and one load. `payRules` is `null`. `emptyReturnRequired` is `null`. Neither load has a customer rate.

### Script the isolation checks follow

1. Alpha’s owner lists loads and sees only `SYN-ISO-A-001`. Fetching Bravo’s load by id returns 404.
2. Alpha’s owner assigns Bravo’s driver or Bravo’s truck and expects `not_found`. The attempt does not write a row in Bravo.
3. Bravo’s driver does not see Alpha’s load. Alpha’s driver does not see Bravo’s load.
4. Alpha’s truck list is only `SYN-A-01`. Bravo’s truck list is only `SYN-B-01`.

## Pay and empty return

Do not add `18500`, `9500`, `25000`, or `27` to any of these files to “make the numbers look real.” Those are pitch rates. Do not add a `pay_rules` table, a ledger, or a required `empty_returned` event. Driver-pay calculations stay disabled until the customer confirms them. Completion, cancellation, handoffs, and empty returns are pre-pilot gates in [requirements.md](../requirements.md).
