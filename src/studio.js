"use strict";
// The world's people and buildings, and chats forked from a scene (the user, 2026-11-21: "selecting on the strand view canvas
// and add fork to enable a character simulation chat, a character and building library"). A book linked to a reading of a
// world answers for the whole world (story-graph's engine/persona/studio.mjs through the server's novel/studio…): every book
// read, one cast. A scene picked on the Strands graph gets a card above the graph; from it a chat is forked with anyone in
// the scene who is of the cast: they are as they were at that scene, knowing only what they lived up to it, and what is said
// stays on the chat's own branch (the books never change). Cast & places lists everyone and every place across the books.
// Loaded after console.js, whose globals (current, world, ask, esc, …) it uses.

// ---------- The world of the open book (loaded once per book, kept). ----------
const studios = new Map();
let castPick = null, castDetail = new Map();
function studioData(at = current) {
  if (!at) return null;
  if (!studios.has(at.key)) {
    const entry = { data: null, error: null, ready: null };
    entry.ready = ask(at.folder, "novel/studio", { id: at.id }).then((data) => { entry.data = data; }, (error) => { entry.error = error.message; })
      .then(() => { if (current === at) { if (leftView === "strands") renderView("strands"); if (leftView === "cast") renderCast(); } });
    studios.set(at.key, entry);
  }
  return studios.get(at.key);
}
const personName = (data, id) => data?.people.find((p) => p.id === id)?.name ?? id;

// ---------- A scene picked on the Strands graph. ----------
function pickScene(id) {
  strandPick = id; studioData();
  renderStrands($("v-strands"));
  $("v-strands").querySelector(".srow.picked")?.scrollIntoView({ block: "nearest" });
}
function pickCard() {
  if (!strandPick || !world?.scenes) return `<div class="pick hint">Pick a scene on the graph (click it, then ↑ ↓) to see who is there and fork a chat from that moment.</div>`;
  const scene = world.scenes.find((entry) => entry.id === strandPick);
  if (!scene) return "";
  const studio = studioData(), data = studio?.data;
  const people = scene.present.filter((id) => world.movables[id]?.[1] === "person");
  const who = people.map((id) => {
    const member = data?.members?.[id];
    return member ? `<button class="fork" data-fork="${esc(id)}" title="Chat with ${esc(nameOf(id))} as they are at this scene">${esc(nameOf(id))} <span>Fork chat ›</span></button>` : `<span class="chip off" title="${studio?.error ? esc(studio.error) : data ? "Not one of the world's cast" : "Loading the world…"}">${esc(nameOf(id))}</span>`;
  }).join("");
  const n = storyScenes().indexOf(scene);
  return `<div class="pick" style="--lc:${colorOf(scene.strand)}">
    <div class="pick-head"><i></i><b>Scene ${n + 1}</b><span class="mini">${esc(whenOf(scene))}</span><span class="grow"></span><button class="icon small" data-pick-step="-1" title="Earlier scene (↑)">↑</button><button class="icon small" data-pick-step="1" title="Later scene (↓)">↓</button><button class="icon small" data-pick-clear title="Clear">×</button></div>
    <div class="pick-where">${esc(placeName(scene.place))}</div>
    <div class="pick-who">${who || `<span class="mini">No one named is here.</span>`}</div>
    ${data ? `<div class="mini">${esc(data.world)} · ${esc(data.book)}${data.mock ? " · mock replies" : ""}</div>` : studio?.error ? `<div class="mini warn">${esc(studio.error)}</div>` : `<div class="mini"><span class="spin"></span> Opening the world…</div>`}
  </div>`;
}
function stepPick(by) {
  const scenes = storyScenes(), at = scenes.findIndex((scene) => scene.id === strandPick);
  const next = scenes[Math.max(0, Math.min(scenes.length - 1, at < 0 ? 0 : at + by))];
  if (next) { pickScene(next.id); reveal(next.first); }
}
function pickClick(event) {
  const fork = event.target.closest("[data-fork]")?.dataset.fork;
  if (fork) { const scene = world.scenes.find((entry) => entry.id === strandPick); forkChat({ scene: scene.id, person: fork, label: nameOf(fork), when: whenOf(scene) }); return; }
  const step = event.target.closest("[data-pick-step]")?.dataset.pickStep; if (step) { stepPick(Number(step)); return; }
  if (event.target.closest("[data-pick-clear]")) { strandPick = null; renderStrands($("v-strands")); }
}
document.addEventListener("keydown", (event) => {
  if (leftView !== "strands" || !leftOpen() || !strandPick || event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.target.closest?.("input, textarea, [contenteditable]")) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); stepPick(event.key === "ArrowDown" ? 1 : -1); }
});

// ---------- Forked chats (the right panel's Characters). ----------
const calls = [];
let callOn = null, callBusy = false;
function showPanel(kind) {
  for (const button of document.querySelectorAll("#panel-kind button")) button.setAttribute("aria-pressed", String(button.dataset.panel === kind));
  for (const view of document.querySelectorAll("#panel .panel-view")) view.classList.toggle("active", view.dataset.view === kind);
  $("chat-count").hidden = kind !== "chat";
  if (!panelOpen()) setPanel(true);
  if (kind === "call") renderCalls();
}
for (const button of document.querySelectorAll("#panel-kind button")) button.addEventListener("click", () => showPanel(button.dataset.panel));

/** A chat forked at a scene: { scene, book?, person (the book's entity or a person of the cast), label, when }. */
async function forkChat({ scene, book, person, label, when }) {
  const at = current; if (!at) return;
  const entry = { id: null, key: `${Date.now()}`, folder: at.folder, bookId: at.id, name: label, when, at: null, card: "", present: "", messages: [], forking: true, world: null };
  calls.push(entry); callOn = entry; showPanel("call");
  say(`Forking a chat with ${label}: writing who they are and where they are at that point…`);
  try {
    const out = await ask(at.folder, "novel/fork", { id: at.id, scene, person, ...(book ? { book } : {}) });
    Object.assign(entry, { id: out.call, name: out.name, at: out.at, card: out.card, present: out.present, world: out.world, mock: out.mock, branch: out.branch, forking: false });
    say(`${out.name}, as of ${out.at}: ready.`);
  } catch (error) { entry.forking = false; entry.error = error.message; say(error.message, true); }
  renderCalls();
}
const whereText = (w) => (w ? [w.where?.length ? w.where.slice(0, 3).join(" < ") : null, w.when, w.with?.length ? `with ${w.with.slice(0, 4).join(", ")}` : null].filter(Boolean).join(" · ") : "");
function renderCalls() {
  $("calls").innerHTML = calls.map((entry) => `<button data-call="${esc(entry.key)}" aria-selected="${entry === callOn}">${esc(entry.name)}<span class="k">${esc(entry.at ?? "…")}</span></button>`).join("");
  const entry = callOn, head = $("call-head"), body = $("call-body");
  $("call-compose").hidden = !entry || !entry.id;
  if (!entry) { head.innerHTML = ""; body.innerHTML = `<p class="note">No chats yet. Pick a scene on the Strands graph and fork a chat with someone in it, or open Cast &amp; places and chat with anyone as of the end of a book.</p>`; return; }
  if (entry.forking) { head.innerHTML = `<div class="call-who"><b>${esc(entry.name)}</b></div>`; body.innerHTML = `<p class="note"><span class="spin"></span> Writing ${esc(entry.name)}'s cards for this point: who they are, and where they are now…</p>`; return; }
  if (entry.error) { head.innerHTML = `<div class="call-who"><b>${esc(entry.name)}</b></div>`; body.innerHTML = `<p class="note warn">${esc(entry.error)}</p>`; return; }
  head.innerHTML = `<div class="call-who"><b>${esc(entry.name)}</b><span class="mini">as of ${esc(entry.at)}${entry.mock ? " · mock" : ""}</span></div>
    <div class="mini call-where">${esc(whereText(entry.world))}</div>
    <details><summary>Who they are</summary><pre>${esc(entry.card)}</pre></details>
    <details><summary>Right now</summary><pre>${esc(entry.present)}</pre></details>`;
  body.innerHTML = entry.messages.map((m) => m.kind === "me" ? `<div class="msg user">${esc(m.text)}</div>`
    : m.kind === "them" ? `<div class="msg assistant char">${m.text ? esc(m.text) : `<i class="mini">(says nothing)</i>`}${m.mood ? `<span class="tools">${esc(m.mood)}</span>` : ""}</div>`
    : m.kind === "god" ? `<div class="msg god"><span class="tools">The world</span>${esc(m.text)}</div>`
    : m.kind === "time" ? `<div class="note time">${esc(m.text)}</div>`
    : `<div class="msg pending">${esc(m.text)}</div>`).join("") || `<p class="note">You are on the line with ${esc(entry.name)}. They don't know you; say hello.</p>`;
  body.scrollTop = body.scrollHeight;
}
$("calls").addEventListener("click", (event) => { const key = event.target.closest("[data-call]")?.dataset.call; if (!key) return; callOn = calls.find((entry) => entry.key === key) ?? callOn; renderCalls(); });
const moodText = (mood) => (mood ? `${mood.valence >= 0.15 ? "warm" : mood.valence <= -0.15 ? "upset" : "even"}, ${mood.arousal >= 0.55 ? "stirred" : mood.arousal <= 0.25 ? "calm" : "alert"}` : "");
async function callSend(kind) {
  const entry = callOn; if (!entry?.id || callBusy) return;
  const text = $("call-text").value.trim();
  if (kind !== "wait" && !text) return;
  callBusy = true; $("call-text").value = "";
  if (kind === "say") entry.messages.push({ kind: "me", text });
  if (kind === "ask") entry.messages.push({ kind: "me", text: `To the world: ${text}` });
  entry.messages.push({ kind: "pending", text: kind === "ask" ? "The world is looking…" : kind === "wait" ? "Time passes…" : `${entry.name} is thinking…` });
  renderCalls();
  try {
    if (kind === "ask") {
      const out = await ask(entry.folder, "novel/callAsk", { id: entry.bookId, call: entry.id, question: text });
      entry.messages.pop(); entry.messages.push({ kind: "god", text: out.answer ?? JSON.stringify(out) });
    } else {
      const out = await ask(entry.folder, "novel/callTurn", { id: entry.bookId, call: entry.id, text: kind === "wait" ? null : text });
      entry.messages.pop();
      if (out.world?.moved) entry.messages.push({ kind: "time", text: `Time passes: now ${whereText(out.world)} (${out.world.moved.book})` });
      entry.world = out.world ?? entry.world;
      entry.messages.push({ kind: "them", text: out.said ?? "", mood: moodText(out.mood) });
    }
  } catch (error) { entry.messages.pop(); entry.messages.push({ kind: "pending", text: error.message }); }
  callBusy = false; renderCalls();
}
$("call-compose").addEventListener("submit", (event) => { event.preventDefault(); callSend("say"); });
$("call-text").addEventListener("keydown", (event) => { if (event.key === "Enter" && mod(event)) { event.preventDefault(); callSend("say"); } });
$("call-wait").addEventListener("click", () => callSend("wait"));
$("call-ask").addEventListener("click", () => callSend("ask"));

// ---------- Cast & places: everyone and every place of the world, across its books. ----------
function renderCast() {
  const body = $("l-cast"), kind = remember.get("castKind", "people");
  for (const button of document.querySelectorAll("#cast-kind button")) button.setAttribute("aria-pressed", String(button.dataset.kind === kind));
  if (!current) { body.innerHTML = `<p class="empty">Open a book that belongs to a world (a series read as one) to see its cast and places across every book.</p>`; setCount("cast", ""); return; }
  const studio = studioData();
  if (studio.error) { body.innerHTML = `<p class="empty">${esc(studio.error)}</p>`; return; }
  if (!studio.data) { body.innerHTML = `<p class="empty"><span class="spin"></span> Opening the world: its cast, memories and places…</p>`; return; }
  const data = studio.data, filter = $("cast-filter").value.trim().toLowerCase();
  const fits = (names) => !filter || names.some((name) => String(name).toLowerCase().includes(filter));
  if (kind === "people") {
    const list = data.people.filter((p) => fits([p.name, ...p.forms])).slice(0, 300);
    setCount("cast", `${data.people.length} people`);
    body.innerHTML = `<div class="mini cast-sum">${esc(data.world)} · ${data.books.length} books · ${data.people.length} people · ${data.places.length} places</div><ul class="rows">${list.map((p) => `<li data-person="${esc(p.id)}" class="${castPick?.id === p.id ? "on" : ""}"><span class="nm c-person">${esc(p.name)}</span><span class="bk">${bookDots(data, p.books)}</span><span class="n">${p.scenes} scenes</span></li>${castPick?.id === p.id ? `<li class="inline">${personDetail(data, p.id)}</li>` : ""}`).join("")}</ul>`;
  } else {
    const list = data.places.filter((p) => (kind === "places" || p.scale === "building") && fits([p.label])).slice(0, 400);
    setCount("cast", `${list.length} ${kind === "buildings" ? "buildings" : "places"}`);
    body.innerHTML = `${kind === "buildings" ? buildingMap(data, list) : ""}<ul class="rows">${list.map((p) => `<li data-place="${esc(p.id)}" class="${castPick?.id === p.id ? "on" : ""}"><span class="nm c-place">${esc(p.label)}</span><span class="sc">${esc(p.scale ?? "")}${p.built ? " · built" : ""}</span><span class="n">${p.scenes} scenes</span></li>${castPick?.id === p.id ? `<li class="inline">${placeDetail3(data, p.id)}</li>` : ""}`).join("")}</ul>`;
  }
  body.querySelector("li.on")?.scrollIntoView({ block: "nearest" });
}
const bookDots = (data, books) => data.books.map((b) => `<i class="${books.includes(b.book) ? "in" : ""}" title="${esc(b.book)}"></i>`).join("");
function detailOf(kind, id) {
  const key = `${current.key}|${kind}|${id}`;
  if (!castDetail.has(key)) {
    const entry = { value: null, error: null };
    castDetail.set(key, entry);
    ask(current.folder, kind === "person" ? "novel/studioPerson" : "novel/studioPlace", { id: current.id, [kind]: id }).then((value) => { entry.value = value; }, (error) => { entry.error = error.message; }).then(renderCast);
  }
  return castDetail.get(key);
}
function personDetail(data, id) {
  const entry = detailOf("person", id);
  if (entry.error) return `<p class="empty">${esc(entry.error)}</p>`;
  if (!entry.value) return `<p class="empty"><span class="spin"></span></p>`;
  const p = entry.value, most = Math.max(1, ...p.books.map((b) => b.scenes));
  return `<div class="detail">
    ${p.forms.length > 1 ? `<div class="mini">Also called ${esc(p.forms.filter((f) => f !== p.name).slice(0, 6).join(", "))}</div>` : ""}
    <div class="bars">${p.books.map((b) => `<div><span>${esc(b.book)}</span><i style="width:${Math.round((b.scenes / most) * 100)}%"></i><span class="mini">${b.scenes} scenes${b.memories ? ` · ${b.memories} memories` : ""}</span></div>`).join("")}</div>
    <h4>Chat with them as of</h4>
    <div class="chips">${p.forkable.map((f) => `<button class="fork" data-fork-person="${esc(id)}" data-fork-book="${esc(f.book)}" data-fork-scene="${esc(f.scene)}" data-fork-when="${esc(f.when)}" title="The end of ${esc(f.book)}: ${esc(f.when)}">${esc(f.book)} <span>${esc(f.when)}</span></button>`).join("")}</div>
    ${p.met.length ? `<h4>Most often with</h4><div class="chips">${p.met.map((m) => `<button class="chip" data-person-open="${esc(m.id)}">${esc(m.name)} ${m.scenes}</button>`).join("")}</div>` : ""}
    ${p.places.length ? `<h4>Where they go</h4><div class="chips">${p.places.map((x) => `<button class="chip c-place" data-place-open="${esc(x.id)}" title="${esc(x.chain.join(" < "))}">${esc(x.label)} ${x.scenes}</button>`).join("")}</div>` : ""}
    ${p.lived.length ? `<h4>What they lived (their strongest memories)</h4><ul class="lived">${p.lived.map((m) => `<li><span class="mini">${esc(m.book)}</span> ${esc(m.what)}</li>`).join("")}</ul>` : ""}
  </div>`;
}
/** A building's box drawn in projection: its footprint (metres) and floors. */
function boxSvg(box, floors) {
  if (!box) return "";
  const [, , w, d] = box, h = Math.max(1, floors ?? 1) * 3.3, c = Math.cos(Math.PI / 6), s = 0.5;
  const P = (x, y, z) => [(x - y) * c, (x + y) * s - z];
  const pts = { a: P(0, 0, 0), b: P(w, 0, 0), c: P(w, d, 0), d: P(0, d, 0), A: P(0, 0, h), B: P(w, 0, h), C: P(w, d, h), D: P(0, d, h) };
  const xs = Object.values(pts).map((p) => p[0]), ys = Object.values(pts).map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), k = 110 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const q = (p) => `${((p[0] - minX) * k + 8).toFixed(1)},${((p[1] - minY) * k + 8).toFixed(1)}`;
  const face = (names, fill) => `<polygon points="${names.map((n) => q(pts[n])).join(" ")}" fill="${fill}" stroke="var(--accent)" stroke-width="1"/>`;
  const lines = Array.from({ length: Math.max(0, (floors ?? 1) - 1) }, (_, i) => { const z = (i + 1) * 3.3; return `<polyline points="${[P(0, d, z), P(w, d, z), P(w, 0, z)].map(q).join(" ")}" fill="none" stroke="var(--accent)" stroke-opacity=".35"/>`; }).join("");
  return `<svg class="iso" viewBox="0 0 126 126" width="126" height="126">${face(["d", "c", "C", "D"], "var(--raised)")}${face(["c", "b", "B", "C"], "var(--chip)")}${face(["A", "B", "C", "D"], "var(--current)")}${lines}</svg>`;
}
function buildingMap(data, list) {
  const built = list.filter((p) => p.box && data.staged.includes(p.books[0]) && p.books[0] === (data.staged.includes(data.book) ? data.book : data.staged[0]));
  if (built.length < 3) return "";
  const xs = built.map((p) => p.box[0]), ys = built.map((p) => p.box[1]), minX = Math.min(...xs), minY = Math.min(...ys), span = Math.max(1, Math.max(...xs) - minX, Math.max(...ys) - minY);
  const W = 300, k = (W - 20) / span, H = Math.max(120, Math.min(W, (Math.max(...ys) - minY) * k + 30));
  return `<div class="bmap"><div class="mini">${esc(built[0].books[0])}: the ${built.length} buildings the world engine built, from above</div><svg viewBox="0 0 ${W} ${H.toFixed(0)}" width="100%">${built.map((p) => `<rect data-place="${esc(p.id)}" x="${((p.box[0] - minX) * k + 10).toFixed(1)}" y="${((p.box[1] - minY) * k + 10).toFixed(1)}" width="${Math.max(7, p.box[2] * k).toFixed(1)}" height="${Math.max(7, p.box[3] * k).toFixed(1)}" class="${castPick?.id === p.id ? "on" : ""}"><title>${esc(p.label)}</title></rect>`).join("")}</svg></div>`;
}
function placeDetail3(data, id) {
  const entry = detailOf("place", id);
  if (entry.error) return `<p class="empty">${esc(entry.error)}</p>`;
  if (!entry.value) return `<p class="empty"><span class="spin"></span></p>`;
  const p = entry.value;
  return `<div class="detail">
    <div class="mini">${esc(p.chain.slice(1).join(" < ") || p.scale || "")}${p.books.length ? ` · in ${esc(p.books.join(", "))}` : ""}</div>
    ${p.box ? `<div class="built">${boxSvg(p.box.box, p.box.floors)}<div class="mini">Built by the world engine<br>${p.box.box[2]} × ${p.box.box[3]} m, ${p.box.floors ?? 1} ${p.box.floors === 1 ? "floor" : "floors"}</div></div>` : ""}
    ${p.children.length ? `<h4>Inside</h4><div class="chips">${p.children.slice(0, 24).map((c) => `<button class="chip c-place" data-place-open="${esc(c.id)}">${esc(c.label)}${c.scenes ? ` ${c.scenes}` : ""}</button>`).join("")}</div>` : ""}
    ${p.people.length ? `<h4>Who comes here</h4><div class="chips">${p.people.map((m) => `<button class="chip" data-person-open="${esc(m.id)}">${esc(m.name)} ${m.scenes}</button>`).join("")}</div>` : ""}
    ${p.scenes.length ? `<h4>Scenes here</h4>${p.scenes.slice(0, 40).map((s) => `<div class="scene-row"><span class="mini">${esc(s.book)} · ${esc(s.when)} · ${esc(s.people.join(", "))}</span>${s.happens.length ? `<span>${esc(s.happens[0])}</span>` : ""}</div>`).join("")}` : ""}
  </div>`;
}
$("l-cast").addEventListener("click", (event) => {
  const fork = event.target.closest("[data-fork-person]");
  if (fork) { const data = studioData().data; forkChat({ scene: fork.dataset.forkScene, book: fork.dataset.forkBook, person: fork.dataset.forkPerson, label: personName(data, fork.dataset.forkPerson), when: fork.dataset.forkWhen }); return; }
  const openPerson = event.target.closest("[data-person-open]")?.dataset.personOpen;
  if (openPerson) { remember.set("castKind", "people"); $("cast-filter").value = ""; castPick = { kind: "person", id: openPerson }; renderCast(); return; }
  const openPlace = event.target.closest("[data-place-open]")?.dataset.placeOpen;
  if (openPlace) { remember.set("castKind", "places"); $("cast-filter").value = ""; castPick = { kind: "place", id: openPlace }; renderCast(); return; }
  if (event.target.closest(".detail")) return;
  const person = event.target.closest("[data-person]")?.dataset.person, place = event.target.closest("[data-place]")?.dataset.place;
  if (person) castPick = castPick?.id === person ? null : { kind: "person", id: person };
  else if (place) castPick = castPick?.id === place ? null : { kind: "place", id: place };
  else return;
  renderCast();
});
for (const button of document.querySelectorAll("#cast-kind button")) button.addEventListener("click", () => { remember.set("castKind", button.dataset.kind); castPick = null; renderCast(); });
$("cast-filter").addEventListener("input", () => renderCast());
