# /platform/sales/performance and /sales/agency — screenshots

The real pages (`app/platform/sales/performance/page.js`,
`app/sales/agency/performance/page.js`, `app/sales/agency/call-quality/page.js`)
rendered through `harness/` against `harness/fixtures/*.json` — snapshots of
what their routes returned for the REAL database, written by `dump.mjs`
(read-only, through the same loaders the routes call). Nothing below the
data layer is mocked; the shared CallPerformanceSections and the i18n hook
are the shipped ones.

```sh
node --env-file=.env --import ./scripts/alias-loader.mjs docs/screens/sales-performance/harness/dump.mjs thisMonth
sh docs/screens/sales-performance/harness/build.sh /tmp/perf-harness
sh docs/screens/sales-performance/harness/shoot.sh /tmp/perf-harness
```

| file | what |
|---|---|
| `platform-performance-1600.png` | The platform page: the rebuilt calls table (one denominator, plain-word buckets, source under every header, the stacked bar, the reconciliation line) |
| `agency-performance-1600.png` | The same table scoped to an agency's team, in the sales portal |
| `agency-call-quality-1280.png` | The agency's call-quality queue |
