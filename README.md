# SnapDispatch

Dispatch prototype for **Westshore Drayage**, a fictional Oakland container carrier. SnapDispatch is the product. A small “Powered by SnapBiz Data” mark sits in the sidebar.

The owner board and the driver phone share one set of demo records. Assign a load, accept it as the driver, add a toll, approve it, and the load cost, driver balance, and Excel preview all move together. Edits stay in this browser until you reset the demo.

There is no login, database, payment processor, or GPS account. Tracking is simulated. Excel sync is simulated.

Production-transition docs, including the first-workflow plan, live in [docs/README.md](docs/README.md). The pitch on `/` is unchanged. A separate technical checkpoint lives at `/app` and is not a live pilot. Setup, synthetic accounts, and the two-browser walkthrough are in [docs/SETUP.md](docs/SETUP.md). Driver-pay calculations stay disabled.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The app starts on the populated owner overview.

```bash
npm run build
npm run check
```

`check` confirms the seeded book: 12 trucks, 16 drivers, 40 loads, and that driver balances match the ledger.

## Pitch path

Use **Start walkthrough**. It restores the original demo, then walks through an unassigned Northbay container: assign Rosa Delgado and WS-119, switch to her phone, pick up, submit a $45 toll she paid, approve it, review the load contribution, deliver and upload the sample blue POD, record the empty return, pay part of her settlement, and open the Excel preview.

**Reset demo** puts the original company back.

## What’s included

Overview, dispatch board, load details, fleet schematic, drivers and pay, expenses and receipts, trucks and maintenance, documents, performance, and an Excel-style export. The driver phone has Today, My Loads, Expenses, Earnings, and Profile.
