// Scripted interactions for a frame, by ?do=<name>. Sets data-harness-done
// on <html> when finished so cdp-shot.mjs knows to capture.
(function () {
  const doName = new URLSearchParams(location.search).get("do");
  const done = () => document.documentElement.setAttribute("data-harness-done", "1");
  const fail = (e) => { document.documentElement.setAttribute("data-scene-error", String(e)); done(); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error("no " + sel); el.click(); };
  const byText = (text, root = document) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
  async function run() {
    await wait(600);
    if (doName === "reply") {
      byText("Reply").click(); await wait(400);
      const ta = document.querySelector("textarea");
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      set.call(ta, "Invite is on its way — see you both Thursday at 10.\n\n- Zoom link in the invite\n- Bring one recent quote if you can"); ta.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(300);
    } else if (doName === "quoted") {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Show quoted text"); if (b) b.click(); await wait(200);
    } else if (doName === "compose") {
      byText("New email").click(); await wait(500);
      const first = document.querySelector("ul li button"); if (first) first.click(); await wait(500);
    } else if (doName === "keys") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true })); await wait(200);
    } else if (doName === "context") {
      byText("Contact").click(); await wait(300);
    } else if (doName === "search") {
      const inp = document.querySelector('input[placeholder="Search subject, message or name"]');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(inp, "invite"); inp.dispatchEvent(new Event("input", { bubbles: true })); await wait(700);
    } else if (doName === "templates") {
      byText("Reply").click(); await wait(400);
      const tb = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Templates")); tb.click(); await wait(300);
    }
    done();
  }
  if (doName) run().catch(fail);
})();
