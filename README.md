# Budget

A simple personal budget app that runs entirely in your browser. No accounts, no server, and no dependencies.

## Features

- Log income and expenses with a category, date and note
- Monthly summary of income, spending and what's left
- Monthly limit per category, with progress bars that turn amber at 80% and red when you go over
- Move between months, search, and filter by type
- Edit or delete any transaction
- Add your own categories
- Pick your currency (USD, EUR, GBP, INR, NPR, CAD, AUD, JPY)
- Export to CSV, plus JSON backup and restore
- Light and dark mode follow your system setting

Data is saved in your browser's `localStorage`. Clearing site data erases it, so use **Backup (JSON)** to keep a copy.

## Run it

Open `index.html` in a browser. To serve it locally instead:

```sh
npm start   # serves on http://localhost:8000
```

## Tests

The budget logic lives in `budget.js` and is covered by Node's built-in test runner (Node 18+):

```sh
npm test
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout |
| `styles.css` | Styles, including dark mode and mobile layout |
| `budget.js` | Pure budget logic (totals, budgets, CSV, validation) |
| `app.js` | UI wiring and `localStorage` persistence |
| `tests/` | Unit tests for `budget.js` |
