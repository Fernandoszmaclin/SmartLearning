/* SmartLearning workspace - Notion-like block editor.
   Plain JS, no build step. Talks to the JSON API under /app/api/. */
(function () {
  "use strict";

  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? m.pop() : "";
  }
  const CSRF = getCookie("csrftoken");

  async function api(url, method, body) {
    const res = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(method + " " + url + " -> " + res.status);
    return res.status === 204 ? {} : res.json();
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  const pane = document.getElementById("editor-pane");
  const PAGES_URL = pane ? pane.dataset.apiPages : "/app/api/pages/";
  const pageId = pane && pane.dataset.pageId ? pane.dataset.pageId : null;

  const pageUrl = (id) => PAGES_URL + id + "/";
  const blocksUrl = (id) => PAGES_URL + id + "/blocks/";
  const reorderUrl = (id) => PAGES_URL + id + "/reorder/";
  const blockUrl = (id) => "/app/api/blocks/" + id + "/";

  async function createPage(parent) {
    const data = await api(PAGES_URL, "POST", parent ? { parent: parent } : {});
    window.location.href = "/app/p/" + data.id + "/";
  }

  const newBtn = document.getElementById("new-page");
  if (newBtn) newBtn.addEventListener("click", () => createPage(null));
  const newEmpty = document.getElementById("new-page-empty");
  if (newEmpty) newEmpty.addEventListener("click", () => createPage(null));

  document.querySelectorAll("[data-add-child]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      createPage(btn.getAttribute("data-add-child"));
    });
  });

  if (!pageId) { initSidebarToggle(); return; }

  const blocksEl = document.getElementById("blocks");

  const titleEl = document.getElementById("page-title");
  if (titleEl) {
    const saveTitle = debounce(() => {
      api(pageUrl(pageId), "PATCH", { title: titleEl.textContent.trim() }).catch(console.error);
    }, 500);
    titleEl.addEventListener("input", saveTitle);
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const first = blocksEl.querySelector(".block-text");
        if (first) focusEnd(first); else addBlockAtEnd();
      }
    });
  }

  const iconEl = document.getElementById("page-icon");
  if (iconEl) {
    iconEl.addEventListener("click", () => {
      const next = window.prompt("Ícone da página (um emoji):", iconEl.textContent.trim());
      if (next && next.trim()) {
        const value = Array.from(next.trim())[0];
        iconEl.textContent = value;
        api(pageUrl(pageId), "PATCH", { icon: value }).catch(console.error);
      }
    });
  }

  const fav = document.getElementById("fav-toggle");
  if (fav) {
    fav.addEventListener("click", async () => {
      const on = !fav.classList.contains("is-on");
      fav.classList.toggle("is-on", on);
      const star = fav.querySelector("svg");
      if (star) star.setAttribute("fill", on ? "currentColor" : "none");
      try { await api(pageUrl(pageId), "PATCH", { is_favorite: on }); }
      catch (err) { console.error(err); }
    });
  }

  const del = document.getElementById("delete-page");
  if (del) {
    del.addEventListener("click", async () => {
      if (!window.confirm("Apagar esta página e todas as subpáginas? Isso não pode ser desfeito.")) return;
      try { await api(pageUrl(pageId), "DELETE"); window.location.href = "/app/"; }
      catch (err) { console.error(err); }
    });
  }

  const BLOCK_KINDS = [
    { kind: "paragraph", label: "Texto" },
    { kind: "heading1", label: "Título 1" },
    { kind: "heading2", label: "Título 2" },
    { kind: "heading3", label: "Título 3" },
    { kind: "todo", label: "Tarefa" },
    { kind: "bullet", label: "Lista" },
    { kind: "quote", label: "Citação" },
    { kind: "code", label: "Código" },
    { kind: "divider", label: "Divisor" },
  ];

  function buildBlock(b) {
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.id = b.id;
    el.dataset.kind = b.kind;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "block-handle";
    handle.setAttribute("aria-label", "Opções do bloco");
    handle.title = "Opções do bloco";
    handle.textContent = "⋮";
    el.appendChild(handle);

    el.appendChild(buildBlockActions());

    if (b.kind === "todo") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "todo-check";
      cb.checked = !!b.checked;
      cb.setAttribute("aria-label", "Marcar tarefa");
      el.appendChild(cb);
    }

    if (b.kind === "divider") {
      const hr = document.createElement("hr");
      hr.className = "block-divider";
      el.appendChild(hr);
    } else {
      const t = document.createElement("div");
      t.className = "block-text" + (b.kind === "todo" && b.checked ? " is-done" : "");
      t.contentEditable = "true";
      t.dataset.placeholder = "Escreva algo, ou aperte / para comandos";
      t.textContent = b.text || "";
      el.appendChild(t);
    }
    return el;
  }

  function buildBlockActions() {
    const actions = document.createElement("div");
    actions.className = "block-actions";
    [
      ["move-up", "↑", "Mover para cima"],
      ["move-down", "↓", "Mover para baixo"],
      ["delete", "×", "Apagar bloco"],
    ].forEach(([action, text, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.blockAction = action;
      btn.setAttribute("aria-label", label);
      btn.title = label;
      btn.textContent = text;
      actions.appendChild(btn);
    });
    return actions;
  }

  function blockOrder() {
    return Array.from(blocksEl.querySelectorAll(".block")).map((el) => Number(el.dataset.id));
  }

  const pushOrder = debounce(() => {
    api(reorderUrl(pageId), "POST", { order: blockOrder() }).catch(console.error);
  }, 300);

  function focusEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const saveBlock = debounce((id, patch) => {
    api(blockUrl(id), "PATCH", patch).catch(console.error);
  }, 500);

  async function createBlockAfter(afterEl, kind) {
    const data = await api(blocksUrl(pageId), "POST", { kind: kind || "paragraph", text: "" });
    const el = buildBlock(data);
    if (afterEl && afterEl.nextSibling) blocksEl.insertBefore(el, afterEl.nextSibling);
    else blocksEl.appendChild(el);
    pushOrder();
    const text = el.querySelector(".block-text");
    if (text) focusEnd(text);
    return el;
  }

  async function addBlockAtEnd() {
    return createBlockAfter(blocksEl.lastElementChild, "paragraph");
  }

  const addBtn = document.getElementById("add-block");
  if (addBtn) addBtn.addEventListener("click", () => addBlockAtEnd());

  async function setKind(blockEl, kind) {
    const id = blockEl.dataset.id;
    const textEl = blockEl.querySelector(".block-text");
    const text = textEl ? textEl.textContent : "";
    await api(blockUrl(id), "PATCH", { kind: kind, text: text, checked: false });
    const fresh = buildBlock({ id: id, kind: kind, text: text, checked: false });
    blockEl.replaceWith(fresh);
    const t = fresh.querySelector(".block-text");
    if (t) focusEnd(t);
  }

  async function deleteBlock(blockEl) {
    const id = blockEl.dataset.id;
    const next = blockEl.nextElementSibling;
    const prev = blockEl.previousElementSibling;
    blockEl.remove();
    try { await api(blockUrl(id), "DELETE"); pushOrder(); }
    catch (err) { console.error(err); }
    const focusTarget = next || prev;
    const text = focusTarget ? focusTarget.querySelector(".block-text") : null;
    if (text) focusEnd(text);
  }

  function moveBlock(blockEl, dir) {
    if (dir < 0) {
      const prev = blockEl.previousElementSibling;
      if (!prev) return;
      blocksEl.insertBefore(blockEl, prev);
    } else {
      const next = blockEl.nextElementSibling;
      if (!next) return;
      blocksEl.insertBefore(next, blockEl);
    }
    pushOrder();
  }

  async function duplicateBlock(blockEl) {
    const text = blockEl.querySelector(".block-text");
    const data = await api(blocksUrl(pageId), "POST", {
      kind: blockEl.dataset.kind,
      text: text ? text.textContent : "",
    });
    const fresh = buildBlock(data);
    if (blockEl.nextSibling) blocksEl.insertBefore(fresh, blockEl.nextSibling);
    else blocksEl.appendChild(fresh);
    pushOrder();
    const target = fresh.querySelector(".block-text");
    if (target) focusEnd(target);
  }

  blocksEl.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.classList.contains("block-text")) return;
    const blockEl = t.closest(".block");
    maybeSlash(t, blockEl);
    saveBlock(blockEl.dataset.id, { text: t.textContent });
  });

  blocksEl.addEventListener("change", (e) => {
    if (!e.target.classList.contains("todo-check")) return;
    const blockEl = e.target.closest(".block");
    const checked = e.target.checked;
    const text = blockEl.querySelector(".block-text");
    if (text) text.classList.toggle("is-done", checked);
    api(blockUrl(blockEl.dataset.id), "PATCH", { checked: checked }).catch(console.error);
  });

  blocksEl.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t.classList.contains("block-text")) return;
    const blockEl = t.closest(".block");

    if (slashOpen && ["ArrowDown", "ArrowUp", "Enter", "Escape"].indexOf(e.key) !== -1) {
      handleSlashNav(e);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const kind = blockEl.dataset.kind;
      const nextKind = kind === "todo" || kind === "bullet" ? kind : "paragraph";
      createBlockAfter(blockEl, nextKind);
    } else if (e.key === "Backspace" && t.textContent.trim() === "") {
      const hasAnotherBlock = blockEl.previousElementSibling || blockEl.nextElementSibling;
      if (hasAnotherBlock) {
        e.preventDefault();
        deleteBlock(blockEl);
      }
    }
  });

  blocksEl.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-block-action]");
    if (actionBtn) {
      const blockEl = actionBtn.closest(".block");
      const action = actionBtn.dataset.blockAction;
      if (action === "move-up") moveBlock(blockEl, -1);
      if (action === "move-down") moveBlock(blockEl, 1);
      if (action === "delete") deleteBlock(blockEl);
      return;
    }

    const handle = e.target.closest(".block-handle");
    if (!handle) return;
    const blockEl = handle.closest(".block");
    const r = handle.getBoundingClientRect();
    openBlockMenu(blockEl, r.left, r.bottom + 4);
  });

  let slashOpen = false;
  let slashMenu = null;
  let slashBlock = null;
  let slashSel = 0;
  let slashItems = [];

  function maybeSlash(textEl, blockEl) {
    const val = textEl.textContent;
    if (val.charAt(0) === "/") {
      openSlash(textEl, blockEl, val.slice(1).toLowerCase());
    } else if (slashOpen) {
      closeSlash();
    }
  }

  function openSlash(textEl, blockEl, query) {
    slashItems = BLOCK_KINDS.filter((k) => k.label.toLowerCase().indexOf(query) !== -1);
    if (!slashItems.length) { closeSlash(); return; }
    if (!slashMenu) {
      slashMenu = document.createElement("div");
      slashMenu.className = "slash-menu";
      document.body.appendChild(slashMenu);
    }
    slashBlock = blockEl;
    slashSel = 0;
    renderSlash();
    const r = textEl.getBoundingClientRect();
    slashMenu.style.left = (window.scrollX + r.left) + "px";
    slashMenu.style.top = (window.scrollY + r.bottom + 4) + "px";
    slashOpen = true;
  }

  function renderSlash() {
    slashMenu.innerHTML = "";
    slashItems.forEach((item, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slash-item" + (i === slashSel ? " is-sel" : "");
      b.textContent = item.label;
      b.addEventListener("mousedown", (ev) => { ev.preventDefault(); pickSlash(i); });
      slashMenu.appendChild(b);
    });
  }

  function handleSlashNav(e) {
    if (e.key === "Escape") { e.preventDefault(); closeSlash(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); slashSel = (slashSel + 1) % slashItems.length; renderSlash(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); slashSel = (slashSel - 1 + slashItems.length) % slashItems.length; renderSlash(); return; }
    if (e.key === "Enter") { e.preventDefault(); pickSlash(slashSel); }
  }

  function pickSlash(i) {
    const item = slashItems[i];
    const blockEl = slashBlock;
    closeSlash();
    if (!item || !blockEl) return;
    const textEl = blockEl.querySelector(".block-text");
    if (textEl) { textEl.textContent = ""; saveBlock(blockEl.dataset.id, { text: "" }); }
    setKind(blockEl, item.kind);
  }

  function closeSlash() {
    slashOpen = false;
    if (slashMenu) { slashMenu.remove(); slashMenu = null; }
    slashBlock = null;
  }

  let blockMenu = null;
  let blockMenuTarget = null;

  function menuButton(label, action, danger) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "block-menu-item" + (danger ? " danger" : "");
    btn.textContent = label;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const target = blockMenuTarget;
      closeBlockMenu();
      if (target) action(target);
    });
    return btn;
  }

  function menuDivider() {
    const line = document.createElement("div");
    line.className = "block-menu-divider";
    return line;
  }

  function openBlockMenu(blockEl, x, y) {
    closeSlash();
    closeBlockMenu();
    blockMenuTarget = blockEl;
    blockMenu = document.createElement("div");
    blockMenu.className = "block-menu";

    blockMenu.appendChild(menuButton("Duplicar", duplicateBlock));
    blockMenu.appendChild(menuButton("+ Abaixo", (b) => createBlockAfter(b, "paragraph")));
    blockMenu.appendChild(menuDivider());
    BLOCK_KINDS.forEach((item) => {
      blockMenu.appendChild(menuButton("Transformar em " + item.label, (b) => setKind(b, item.kind)));
    });
    blockMenu.appendChild(menuDivider());
    blockMenu.appendChild(menuButton("Apagar", deleteBlock, true));

    document.body.appendChild(blockMenu);
    const maxLeft = window.scrollX + document.documentElement.clientWidth - blockMenu.offsetWidth - 10;
    const maxTop = window.scrollY + document.documentElement.clientHeight - blockMenu.offsetHeight - 10;
    blockMenu.style.left = Math.max(10, Math.min(window.scrollX + x, maxLeft)) + "px";
    blockMenu.style.top = Math.max(10, Math.min(window.scrollY + y, maxTop)) + "px";
  }

  function closeBlockMenu() {
    if (blockMenu) blockMenu.remove();
    blockMenu = null;
    blockMenuTarget = null;
  }

  document.addEventListener("click", (e) => {
    if (slashOpen && slashMenu && !slashMenu.contains(e.target)) closeSlash();
    if (blockMenu && !blockMenu.contains(e.target) && !e.target.closest(".block-handle")) closeBlockMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSlash();
      closeBlockMenu();
    }
  });

  function initSidebarToggle() { /* reserved for menu button on small screens */ }
  initSidebarToggle();
})();
