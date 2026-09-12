# /platform/sales/payouts — screenshots

The real page (`app/platform/sales/payouts/page.js`) rendered through
`harness/` against a fixture of two reps, two closed weeks and a reversal
that landed after a close — the same shape `scripts/check-sales-payout-proof.mjs`
executes. Nothing is mocked below the data layer: `@/lib/fetchJson` answers
from `harness/fixtures.js`, and the mark-paid POST mutates the fixture so
the "after" shot is the real component on a real answer.

| file | what |
|---|---|
| `payouts-1280.png` | Owed strip, the period table by week with the CSV link, the Mark paid form filled in on Ana's ready batch, the Paid list with proof lines |
| `payouts-marked-paid-1280.png` | After pressing Mark paid: the notice, the batch moved to Paid with reference and paid-on time, "Update proof" |
| `payouts-by-month-1280.png` | The period switcher on By month |
| `payouts-375.png` | The same at phone width |

Rebuild and reshoot:

```sh
sh docs/screens/platform-payouts/harness/build.sh /tmp/payout-harness
sh docs/screens/platform-payouts/harness/shoot.sh /tmp/payout-harness
```

The same harness shoots `docs/screens/platform-reps/` and
`docs/screens/sales-settings/` (`?page=reps`, `?page=settings`).
