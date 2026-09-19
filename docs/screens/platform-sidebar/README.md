# The platform rail, regrouped — 19 September 2026

The owner: "the side menu seems all bunched up — it's hard to distinguish
earnings from expenditure, and sales team, and /app, and FieldQuo's own."
These frames are `app/components/platform/PlatformSidebar.js` after the
regroup, shot through the platform harness
(`docs/screens/platform-mobile/harness/`) against its fixtures — the real
component inside the real layout, on `/platform/crew-lines` (a Spending row,
and the page whose H1 became "Twilio numbers" in the same change).

| Frame | What it shows |
|---|---|
| `crew-lines-1280.png` | Desktop rail, light theme, every group open. |
| `crew-lines-dark-1280.png` | Same, dark theme. |
| `crew-lines-fold-1280.png` | Light, with Spending and Lead data folded (chevrons turned, rows gone). |
| `crew-lines-fold-dark-1280.png` | Same, dark. |
| `crew-lines-drawer-375.png` | Phone drawer, light, every group open. |
| `crew-lines-drawer-dark-375.png` | Same, dark. |
| `crew-lines-drawer-fold-375.png` | Phone drawer with Spending and Lead data folded. |

    OUT=/tmp/fq-platform-harness sh docs/screens/platform-mobile/harness/build.sh
    OUT=/tmp/fq-platform-harness THEME=dark ROUTES=/platform/crew-lines SIZES=1280 SCENE=fold \
      DEST=docs/screens/platform-sidebar node --experimental-websocket docs/screens/platform-mobile/harness/shoot.mjs

`docs/NAV-AUDIT.md` has the group → rows table and the reasoning;
`scripts/check-platform-console.mjs` pins it.
