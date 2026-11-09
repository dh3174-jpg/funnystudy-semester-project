import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function loadModule(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    name => Object.hasOwn(imports, name) ? imports[name] : require(name), loaded, loaded.exports
  );
  return loaded.exports;
}
const skips = loadModule("src/lib/demographic-skips.ts");
const questions = ["1", "2", "3"].map(id => ({
  id, prompt: `Question ${id}`, options: [{ mappingId: id, id, label: `Answer ${id}` }],
}));
const tick = () => new Promise(resolve => setImmediate(resolve));

function mount(t, { save, initialQuestions = questions, initialSkips = [] } = {}) {
  const slots = [];
  let cursor = 0, tree, timerId = 0;
  const timers = new Map(), requests = [], redirects = [];
  // Execute the real component handlers with persistent hook state and controlled
  // server responses/timers, without requiring a browser or a live database.
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(value) {
      const index = cursor++;
      return slots[index] ??= { current: value };
    },
    useCallback: callback => callback,
    useMemo: factory => factory(),
    useEffect() {},
  };
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = {
    location: { protocol: "https:" },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  globalThis.document = { cookie: "" };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  const router = { push: path => redirects.push(path) };
  const { DemographicQuestionCard } = loadModule("src/components/DemographicQuestionCard.tsx", {
    react: hooks,
    "next/navigation": { useRouter: () => router },
    "@/app/demographics/actions": { saveDemographicQuestionAnswerSelection: async input => {
      requests.push(input);
      return save ? save(input) : { success: true, redirectPath: "/demographics?next=%2Fstudy%2F42" };
    } },
    "@/lib/demographic-skips": skips,
  });
  function render() {
    cursor = 0;
    tree = DemographicQuestionCard({ next: "/study/42", profileId: "participant", questions: initialQuestions, skipped: initialSkips });
    return tree;
  }
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (typeof node.type === "function") return nodes(node.type(node.props));
    return [node, ...nodes(node.props?.children)];
  }
  function text(node) {
    if (node == null || typeof node === "boolean") return "";
    if (Array.isArray(node)) return node.map(text).join("");
    return typeof node === "object" ? text(node.props?.children) : String(node);
  }
  render();
  return {
    requests, redirects, timers,
    render,
    text: () => text(tree),
    click(label) {
      render();
      const button = nodes(tree).find(node => node.type === "button" &&
        (text(node) === label || node.props["aria-label"] === label));
      assert.ok(button, `Missing button: ${label}`);
      button.props.onClick();
      render();
    },
    cookie: () => globalThis.document.cookie,
    skipped: () => skips.readDemographicSkips(globalThis.document.cookie.split(";")[0].split("=")[1], "participant"),
    expireTimers() { for (const [id, fn] of timers) { timers.delete(id); fn(); } render(); },
  };
}

test("skip remaining is session-scoped and redirects without creating any answers", t => {
  const view = mount(t, { initialSkips: ["older"] });
  assert.match(view.text(), /Optional/);
  view.click("Skip remaining survey");
  assert.deepEqual(view.skipped(), ["older", "1", "2", "3"]);
  assert.match(view.cookie(), /SameSite=Lax; Secure/);
  assert.doesNotMatch(view.cookie(), /Expires|Max-Age/i);
  assert.deepEqual(view.requests, []);
  assert.deepEqual(view.redirects, ["/study/42"]);
});

test("bulk skip immediately flushes an undoable answer and waits for it before redirect", async t => {
  let resolveSave;
  const view = mount(t, { save: () => new Promise(resolve => { resolveSave = resolve; }) });
  view.click("Answer 1");
  assert.equal(view.requests.length, 0, "earlier responses retain the undo window");
  view.click("Skip remaining survey");
  assert.deepEqual(view.skipped(), ["2", "3"]);
  assert.equal(view.requests.length, 1);
  assert.equal(view.requests[0].questionId, "1");
  assert.equal(view.timers.size, 0);
  assert.deepEqual(view.redirects, []);
  assert.match(view.text(), /Saving your responses/);
  assert.doesNotMatch(view.text(), /Finishing up|All set/);
  resolveSave({ success: true, redirectPath: "/demographics" });
  await tick();
  assert.deepEqual(view.redirects, ["/study/42"]);
});

test("bulk skip waits for both in-flight and queued answers, preserving their values", async t => {
  const complete = new Map();
  const view = mount(t, { save: input => new Promise(resolve => complete.set(input.questionId, resolve)) });
  view.click("Answer 1");
  view.click("Answer 2"); // Commits 1; 2 is undoable.
  view.click("Skip remaining survey");
  assert.deepEqual(view.skipped(), ["3"]);
  assert.deepEqual(view.requests.map(r => r.answerSelection), ["1::1", "2::2"]);
  complete.get("2")({ success: true });
  await tick();
  assert.deepEqual(view.redirects, []);
  complete.get("1")({ success: true });
  await tick();
  assert.deepEqual(view.redirects, ["/study/42"]);
});

test("the final answer saves immediately and follows the existing server redirect", async t => {
  let complete;
  const view = mount(t, { initialQuestions: questions.slice(0, 1), save: () => new Promise(resolve => { complete = resolve; }) });
  view.click("Answer 1");
  assert.equal(view.requests.length, 1);
  assert.equal(view.timers.size, 0);
  assert.match(view.text(), /Saving your responses/);
  assert.deepEqual(view.redirects, []);
  complete({ success: true, redirectPath: "/demographics?next=%2Fstudy%2F42" });
  await tick();
  assert.deepEqual(view.redirects, ["/demographics?next=%2Fstudy%2F42"]);
});

test("failed or thrown saves restore the unanswered question and block navigation", async t => {
  let fail;
  const view = mount(t, { save: () => new Promise((resolve, reject) => { fail = reject; }) });
  view.click("Answer 1");
  view.click("Skip remaining survey");
  fail(new Error("network unavailable"));
  await tick();
  view.render();
  assert.match(view.text(), /Question 1/);
  assert.match(view.text(), /could not save/);
  assert.deepEqual(view.redirects, []);
  assert.deepEqual(view.skipped(), ["2", "3"]);
});

test("a failed earlier save cannot be bypassed by a later successful save", async t => {
  const complete = new Map();
  const view = mount(t, { save: input => new Promise(resolve => complete.set(input.questionId, resolve)) });
  view.click("Answer 1");
  view.click("Answer 2");
  view.click("Skip remaining survey");
  complete.get("1")({ success: false, error: "Please retry this response." });
  await tick();
  complete.get("2")({ success: true });
  await tick();
  view.render();
  assert.match(view.text(), /Question 1/);
  assert.match(view.text(), /Please retry/);
  assert.deepEqual(view.redirects, []);
});

test("single-question skip and previous-answer undo continue to work", async t => {
  const view = mount(t);
  view.click("Answer 1");
  view.click("Go back to previous question");
  assert.equal(view.timers.size, 0);
  view.click("Skip for now");
  assert.deepEqual(view.skipped(), ["1"]);
  assert.match(view.text(), /Question 2/);
  view.click("Answer 2");
  view.expireTimers();
  await tick();
  assert.deepEqual(view.requests.map(r => r.questionId), ["2"]);
  view.click("Skip for now");
  assert.deepEqual(view.skipped(), ["1", "3"]);
  assert.deepEqual(view.redirects, ["/study/42"]);
});
