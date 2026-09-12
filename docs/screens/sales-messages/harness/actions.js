// Drives the rendered page for headless screenshots: ?do=step;step;…
//   wait:ms | click:<selector> | type:<selector>:<text> | scroll:<selector>:<px|top|bottom>
//   key:<selector>:<Key> | focus:<selector> | val:<selector>:<text> (React-safe value set)
(function () {
  const script = new URLSearchParams(location.search).get("do");
  if (!script) return;
  const steps = script.split(";").map((s) => s.trim()).filter(Boolean);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function setValue(el, text) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.setSelectionRange(text.length, text.length);
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "x" }));
  }
  async function run() {
    await sleep(400);
    for (const step of steps) {
      const [op, ...rest] = step.split(":");
      const arg = rest.join(":");
      if (op === "wait") await sleep(Number(arg) || 200);
      else if (op === "click") { const el = document.querySelector(arg); if (el) el.click(); await sleep(250); }
      else if (op === "focus") { const el = document.querySelector(arg); if (el) el.focus(); await sleep(100); }
      else if (op === "type" || op === "val") { const i = arg.indexOf(":"); const el = document.querySelector(arg.slice(0, i)); if (el) { el.focus(); setValue(el, arg.slice(i + 1)); } await sleep(250); }
      else if (op === "key") { const i = arg.indexOf(":"); const el = document.querySelector(arg.slice(0, i)); const key = arg.slice(i + 1); if (el) el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key })); await sleep(250); }
      else if (op === "scroll") { const i = arg.indexOf(":"); const el = document.querySelector(arg.slice(0, i)); const v = arg.slice(i + 1); if (el) { el.scrollTop = v === "top" ? 0 : v === "bottom" ? el.scrollHeight : Number(v); el.dispatchEvent(new Event("scroll")); } await sleep(250); }
    }
    document.documentElement.setAttribute("data-harness-done", "1");
  }
  run();
})();
