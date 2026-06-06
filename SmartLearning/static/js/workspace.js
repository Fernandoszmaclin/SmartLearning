/* SmartLearning workspace - Notion-like block editor.
   Plain JS, no build step. Talks to the JSON API under /academico/workspace/api/. */
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

  async function apiUpload(url, method, formData) {
    const res = await fetch(url, {
      method: method,
      headers: {
        "X-CSRFToken": CSRF,
      },
      body: formData,
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
  const PAGES_URL = pane ? pane.dataset.apiPages : "/workspace/api/pages/";
  const pageId = pane && pane.dataset.pageId ? pane.dataset.pageId : null;

  const pageUrl = (id) => PAGES_URL + id + "/";
  const blocksUrl = (id) => PAGES_URL + id + "/blocks/";
  const reorderUrl = (id) => PAGES_URL + id + "/reorder/";
  const blockUrl = (id) => "/workspace/api/blocks/" + id + "/";
  const moveUrl = (id) => PAGES_URL + id + "/move/";

  async function createPage(parent, title, icon, is_folder=false) {
    const payload = {};
    if (parent) payload.parent = parent;
    if (title) payload.title = title;
    if (icon) payload.icon = icon;
    if (is_folder) payload.is_folder = true;
    
    try {
      const data = await api(PAGES_URL, "POST", payload);
      window.location.href = "/workspace/p/" + data.id + "/";
    } catch (err) {
      alert("Erro ao criar: " + err.message);
      console.error(err);
    }
  }

  const inlineNewBtn = document.getElementById("inline-new-page");
  if (inlineNewBtn) inlineNewBtn.addEventListener("click", () => createPage(null));

  const ctxMenu = document.getElementById("pages-context-menu");
  const sidebarScroll = document.querySelector(".sidebar-scroll");
  
  let ctxTargetPageId = null;

  if (ctxMenu && sidebarScroll) {
    sidebarScroll.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      
      const treeRow = e.target.closest(".tree-row");
      const ctxDivider = document.getElementById("ctx-divider");
      const ctxDelete = document.getElementById("ctx-delete-page");
      
      if (treeRow) {
        ctxTargetPageId = treeRow.getAttribute("data-page-id");
        const isFolder = treeRow.getAttribute("data-is-folder") === "true";
        if (ctxDivider) ctxDivider.style.display = "block";
        if (ctxDelete) ctxDelete.style.display = "flex";
        
        const ctxNewPage = document.getElementById("ctx-new-page");
        const ctxNewFolder = document.getElementById("ctx-new-folder");
        if (ctxNewPage) ctxNewPage.style.display = isFolder ? "flex" : "none";
        if (ctxNewFolder) ctxNewFolder.style.display = isFolder ? "flex" : "none";
        
      } else {
        ctxTargetPageId = null;
        if (ctxDivider) ctxDivider.style.display = "none";
        if (ctxDelete) ctxDelete.style.display = "none";
        const ctxNewPage = document.getElementById("ctx-new-page");
        const ctxNewFolder = document.getElementById("ctx-new-folder");
        if (ctxNewPage) ctxNewPage.style.display = "flex";
        if (ctxNewFolder) ctxNewFolder.style.display = "flex";
      }
      
      ctxMenu.style.display = "flex";
      ctxMenu.style.left = e.clientX + "px";
      ctxMenu.style.top = e.clientY + "px";
    });

    document.addEventListener("click", (e) => {
      if (!ctxMenu.contains(e.target)) {
        ctxMenu.style.display = "none";
      }
    });

    const ctxNewPage = document.getElementById("ctx-new-page");
    if (ctxNewPage) ctxNewPage.addEventListener("click", () => {
      ctxMenu.style.display = "none";
      createPage(ctxTargetPageId);
    });

    const ctxNewFolder = document.getElementById("ctx-new-folder");
    if (ctxNewFolder) ctxNewFolder.addEventListener("click", () => {
      ctxMenu.style.display = "none";
      createPage(ctxTargetPageId, "Nova Pasta", "📁", true);
    });
    
    const ctxDelete = document.getElementById("ctx-delete-page");
    if (ctxDelete) ctxDelete.addEventListener("click", () => {
      ctxMenu.style.display = "none";
      if (ctxTargetPageId) {
        // Usa o mesmo modal de delete
        const delModal = document.getElementById("delete-modal");
        if (delModal) {
          delModal.style.display = "flex";
          delModal.setAttribute("data-target-id", ctxTargetPageId);
        }
      }
    });
  }

  const newEmpty = document.getElementById("new-page-empty");
  if (newEmpty) newEmpty.addEventListener("click", () => createPage(null));

  document.querySelectorAll("[data-add-child]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      createPage(btn.getAttribute("data-add-child"));
    });
  });

  // ---------- Sidebar drag & drop: mover/reordenar páginas e pastas ----------
  (function initTreeDnD() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    let draggedId = null;
    let draggedItem = null;

    const inMain = (el) => el && el.closest(".sidebar-scroll");

    function clearMarks() {
      sidebar.querySelectorAll(".dnd-before,.dnd-after,.dnd-inside")
        .forEach((el) => el.classList.remove("dnd-before", "dnd-after", "dnd-inside"));
      sidebar.querySelectorAll(".dnd-root")
        .forEach((el) => el.classList.remove("dnd-root"));
    }

    function rowOf(target) {
      const row = target.closest ? target.closest(".tree-row") : null;
      return row && inMain(row) ? row : null;
    }

    function zoneFor(row, e) {
      const r = row.getBoundingClientRect();
      const y = e.clientY - r.top;
      if (y < r.height * 0.28) return "before";
      if (y > r.height * 0.72) return "after";
      return "inside";
    }

    function siblingIds(ul) {
      return Array.from(ul.children)
        .filter((li) => li.classList.contains("tree-item"))
        .map((li) => li.querySelector(":scope > .tree-row").dataset.pageId);
    }

    async function doMove(body) {
      try {
        await api(moveUrl(draggedId), "POST", body);
        window.location.reload();
      } catch (err) { console.error(err); clearMarks(); }
    }

    sidebar.addEventListener("dragstart", (e) => {
      const row = rowOf(e.target);
      if (!row || (e.target.closest && e.target.closest(".tree-add, .tree-toggle"))) return;
      draggedId = row.dataset.pageId;
      draggedItem = row.closest(".tree-item");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", draggedId); } catch (_) {}
      setTimeout(() => { if (draggedItem) draggedItem.classList.add("dragging"); }, 0);
    });

    sidebar.addEventListener("dragend", () => {
      clearMarks();
      if (draggedItem) draggedItem.classList.remove("dragging");
      draggedId = null; draggedItem = null;
    });

    sidebar.addEventListener("dragover", (e) => {
      if (!draggedId) return;
      clearMarks();
      const row = rowOf(e.target);
      if (row) {
        const item = row.closest(".tree-item");
        if (item === draggedItem || (draggedItem && draggedItem.contains(item))) return;
        const isFolder = row.getAttribute("data-is-folder") === "true";
        const zone = zoneFor(row, e);
        if (zone === "inside" && !isFolder) return;
        e.preventDefault();
        row.classList.add("dnd-" + zone);
      } else {
        const scroll = e.target.closest && e.target.closest(".sidebar-scroll");
        if (scroll) { e.preventDefault(); scroll.classList.add("dnd-root"); }
      }
    });

    sidebar.addEventListener("dragleave", (e) => {
      const row = e.target.closest && e.target.closest(".tree-row");
      if (row) row.classList.remove("dnd-before", "dnd-after", "dnd-inside");
    });

    sidebar.addEventListener("drop", (e) => {
      if (!draggedId) { clearMarks(); return; }
      e.preventDefault();
      const row = rowOf(e.target);
      if (row) {
        const item = row.closest(".tree-item");
        if (item === draggedItem || (draggedItem && draggedItem.contains(item))) { clearMarks(); return; }
        const zone = zoneFor(row, e);
        const targetId = row.dataset.pageId;
        const isFolder = row.getAttribute("data-is-folder") === "true";
        if (zone === "inside") { 
          if (!isFolder) { clearMarks(); return; }
          clearMarks(); doMove({ parent: targetId }); return; 
        }
        const parentUl = item.parentElement;
        const parentItem = parentUl.closest(".tree-item");
        const parentId = parentItem
          ? parentItem.querySelector(":scope > .tree-row").dataset.pageId : null;
        let ids = siblingIds(parentUl).filter((id) => id !== draggedId);
        const idx = ids.indexOf(targetId);
        ids.splice(zone === "before" ? idx : idx + 1, 0, draggedId);
        clearMarks();
        doMove({ parent: parentId, order: ids });
      } else if (e.target.closest && e.target.closest(".sidebar-scroll")) {
        clearMarks();
        doMove({ parent: null });
      } else {
        clearMarks();
      }
    });
  })();

  // ---------- Árvore: abrir/fechar pastas (subpáginas) ----------
  (function initTreeCollapse() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const KEY = "ws-tree-collapsed";
    let collapsed = new Set();
    try { collapsed = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch (_) {}

    function persist() {
      try { localStorage.setItem(KEY, JSON.stringify([...collapsed])); } catch (_) {}
    }
    function setState(item, isCollapsed) {
      const id = item.dataset.pageId;
      item.classList.toggle("is-collapsed", isCollapsed);
      const toggle = item.querySelector(":scope > .tree-row [data-tree-toggle]");
      if (toggle) toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      if (id) { if (isCollapsed) collapsed.add(id); else collapsed.delete(id); }
    }

    // Aplica os estados salvos.
    sidebar.querySelectorAll(".tree-item.has-children").forEach((item) => {
      if (collapsed.has(item.dataset.pageId)) setState(item, true);
    });

    // A página aberta nunca fica escondida: expande todos os ancestrais.
    const active = sidebar.querySelector(".tree-row.is-active");
    if (active) {
      const self = active.closest(".tree-item");
      let node = self ? self.parentElement.closest(".tree-item") : null;
      while (node) {
        setState(node, false);
        node = node.parentElement.closest(".tree-item");
      }
      persist();
    }

    sidebar.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-tree-toggle]");
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();
      const item = toggle.closest(".tree-item");
      if (item) { setState(item, !item.classList.contains("is-collapsed")); persist(); }
    });
  })();

  // ---------- Gaveta "Anotações" (trabalho/prova): abrir/fechar + filtros ----------
  (function initTasksDrawer() {
    const drawer = document.getElementById("tasks-drawer");
    const openBtn = document.getElementById("open-tasks");
    if (!drawer || !openBtn) return;
    const panel = drawer.querySelector(".tasks-panel");
    const closeEls = drawer.querySelectorAll("[data-tasks-close]");
    const items = Array.from(drawer.querySelectorAll(".tasks-item"));
    const tabs = Array.from(drawer.querySelectorAll(".tasks-tab"));
    const chips = Array.from(drawer.querySelectorAll(".tasks-chip"));
    const showAllBtn = drawer.querySelector("[data-tasks-showall]");
    const emptyEl = drawer.querySelector("[data-tasks-empty]");
    const newLink = drawer.querySelector("[data-tasks-new]");
    const badge = document.querySelector("[data-tasks-badge]");
    const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    const STORE_CAT = "ws-task-cat";
    const STORE_SUB = "ws-task-subject";
    const STORE_ALL = "ws-task-showall";

    let cat = "trabalho";
    let subject = "";
    let showAll = false;
    try {
      cat = localStorage.getItem(STORE_CAT) || cat;
      subject = localStorage.getItem(STORE_SUB) || "";
      showAll = localStorage.getItem(STORE_ALL) === "1";
    } catch (_) {}
    if (!tabs.some((t) => t.dataset.taskCat === cat)) cat = "trabalho";
    if (subject && !chips.some((c) => c.dataset.taskSubject === subject)) subject = "";

    const isDone = (el) => el.dataset.done === "1";

    // Estado dos controles (abas/chips/link "nova"). Não mexe na visibilidade.
    function syncChrome() {
      panel.dataset.cat = cat;
      panel.dataset.subject = subject;
      panel.dataset.showall = showAll ? "1" : "0";

      tabs.forEach((t) => {
        const on = t.dataset.taskCat === cat;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      chips.forEach((c) => c.classList.toggle("is-on", c.dataset.taskSubject === subject));

      if (newLink) {
        try {
          const u = new URL(newLink.href, window.location.origin);
          u.searchParams.set("category", cat);
          newLink.href = u.pathname + "?" + u.searchParams.toString();
        } catch (_) {}
      }
    }

    // Mostra/esconde itens. Só roda ao abrir a gaveta ou trocar de filtro —
    // assim uma tarefa marcada como feita continua visível até reabrir/recarregar.
    function applyFilter() {
      let visible = 0;
      items.forEach((el) => {
        const show = el.dataset.category === cat
          && (!subject || el.dataset.subject === subject)
          && !(isDone(el) && !showAll);
        el.hidden = !show;
        if (show) visible++;
      });
      if (emptyEl) emptyEl.hidden = visible !== 0;
    }

    // Contadores das abas + badge da barra lateral (refletem pendentes).
    function updateCounts() {
      tabs.forEach((t) => {
        const c = t.dataset.taskCat;
        const n = items.filter(
          (el) => el.dataset.category === c && !(isDone(el) && !showAll)
        ).length;
        const tabBadge = t.querySelector(".tasks-count");
        if (tabBadge) tabBadge.textContent = n;
      });
      updateBadge();
    }

    function render() { syncChrome(); applyFilter(); updateCounts(); }

    function updateBadge() {
      if (!badge) return;
      const pending = items.filter((el) => el.dataset.done !== "1").length;
      const changed = String(badge.textContent).trim() !== String(pending);
      badge.textContent = pending;
      badge.hidden = pending === 0;
      if (changed && pending > 0) {
        badge.classList.remove("pulse");
        void badge.offsetWidth;
        badge.classList.add("pulse");
      }
    }

    // Reveal escalonado dos itens visíveis (entrada da gaveta / troca de filtro).
    function revealItems() {
      items.filter((el) => !el.hidden).forEach((el, i) => {
        el.classList.remove("reveal");
        void el.offsetWidth;
        el.style.animationDelay = Math.min(i, 12) * 38 + "ms";
        el.classList.add("reveal");
      });
    }
    function clearReveal() {
      items.forEach((el) => { el.classList.remove("reveal"); el.style.animationDelay = ""; });
    }

    // Toggle/excluir sem recarregar: POST do form via fetch e atualiza no lugar
    // (os <form> continuam funcionando como fallback se o JS falhar).
    async function postForm(form) {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "X-CSRFToken": CSRF },
        body: new FormData(form),
      });
      return res.ok;
    }

    drawer.addEventListener("submit", async (e) => {
      const form = e.target;
      const item = form.closest(".tasks-item");
      if (!item) return;

      if (form.classList.contains("tasks-toggle-form")) {
        e.preventDefault();
        const btn = form.querySelector(".tasks-toggle");
        if (btn) btn.disabled = true;
        const ok = await postForm(form).catch(() => false);
        if (btn) btn.disabled = false;
        if (!ok) { form.submit(); return; }   // fallback: deixa o navegador recarregar
        const nowDone = item.dataset.done !== "1";
        item.dataset.done = nowDone ? "1" : "0";
        item.classList.toggle("is-done", nowDone);
        if (btn) {
          btn.classList.toggle("done", nowDone);
          btn.innerHTML = nowDone ? CHECK_SVG : "";
          if (nowDone) { btn.classList.remove("just-done"); void btn.offsetWidth; btn.classList.add("just-done"); }
        }
        // Retorno visual ao concluir: a linha pisca verde e segue VISÍVEL.
        // Só some quando a gaveta for reaberta ou a página recarregada.
        if (nowDone) { item.classList.remove("just-completed"); void item.offsetWidth; item.classList.add("just-completed"); }
        updateCounts(); save();
      } else if (form.classList.contains("tasks-del-form")) {
        e.preventDefault();
        const msg = form.getAttribute("data-confirm");
        if (msg && !window.confirm(msg)) return;
        const ok = await postForm(form).catch(() => false);
        if (!ok) { form.submit(); return; }
        item.remove();
        const idx = items.indexOf(item);
        if (idx >= 0) items.splice(idx, 1);
        render();
      }
    });

    function save() {
      try {
        localStorage.setItem(STORE_CAT, cat);
        localStorage.setItem(STORE_SUB, subject);
        localStorage.setItem(STORE_ALL, showAll ? "1" : "0");
      } catch (_) {}
    }

    let lastFocus = null;
    function openDrawer() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      // Reabrir = refiltrar: tarefas concluídas na sessão anterior somem agora.
      render();
      // próximo frame → transição de entrada + reveal escalonado dos itens
      requestAnimationFrame(() => { drawer.classList.add("is-open"); revealItems(); });
      openBtn.setAttribute("aria-expanded", "true");
      const close = drawer.querySelector(".tasks-close");
      if (close) close.focus();
    }
    function closeDrawer() {
      clearReveal();
      drawer.classList.remove("is-open");
      openBtn.setAttribute("aria-expanded", "false");
      const onEnd = () => {
        drawer.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      // fallback caso transição não dispare (reduced-motion)
      setTimeout(() => { if (drawer.classList.contains("is-open")) return; drawer.hidden = true; }, 360);
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }

    openBtn.addEventListener("click", openDrawer);
    closeEls.forEach((el) => el.addEventListener("click", closeDrawer));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !drawer.hidden) closeDrawer();
    });

    const afterFilter = () => { if (!drawer.hidden) revealItems(); };
    tabs.forEach((t) => t.addEventListener("click", () => { cat = t.dataset.taskCat; render(); save(); afterFilter(); }));
    chips.forEach((c) => c.addEventListener("click", () => { subject = c.dataset.taskSubject; render(); save(); afterFilter(); }));
    if (showAllBtn) showAllBtn.addEventListener("click", () => { showAll = !showAll; render(); save(); afterFilter(); });

    render();

    // Abrir automaticamente via ?tasks=open (ex.: link externo "Anotações").
    if (new URLSearchParams(window.location.search).get("tasks") === "open") openDrawer();
  })();

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
      openEmojiPicker(iconEl, (emoji) => {
        iconEl.textContent = emoji;
        api(pageUrl(pageId), "PATCH", { icon: emoji }).catch(console.error);
      });
    });
  }

  // ---------- Emoji picker (ícone da página + inserir no texto) ----------
  const EMOJI_GROUPS = [
    ["Estudo", ["📚","📖","📕","📗","📘","📙","📝","✏️","🖊️","🖍️","📐","📏","🧮","🔬","🔭","🧪","🧬","💡","🎓","🏫","📌","🗂️","📁","📂","🗃️","📅","📆","⏰","⏳","✅","⭐","🔥","🎯","🧠","💻","📊","📈","📉"]],
    ["Rostos", ["😀","😃","😄","😁","😆","😅","😂","🙂","😉","😊","😍","😎","🤓","🧐","🤔","😴","😇","🥳","🙃","😬","🤯","😭","😤","🥱","😅"]],
    ["Símbolos", ["❤️","🧡","💛","💚","💙","💜","🖤","✔️","❌","➕","➖","⚡","🌟","💫","🔔","🔒","🔑","♻️","⚠️","🚫","💯","🆕","❗","❓"]],
    ["Objetos", ["💼","📦","🗄️","🖇️","📋","📒","📓","📔","📰","🔖","🏷️","💰","🪙","🎁","🔧","🔨","🧰","⚙️","🧲","🔋"]],
    ["Natureza", ["🌱","🌿","🍀","🌳","🌲","🌵","🌸","🌼","🌻","🌹","🍁","🍂","☀️","🌙","☁️","🌈","💧","❄️","🌊"]],
    ["Comida", ["☕","🍵","🥤","🍎","🍌","🍇","🍓","🥑","🍞","🧀","🍪","🍫","🍰","🎂","🍕","🍔"]],
    ["Atividades", ["⚽","🏀","🎾","🏃","🚴","🧘","🎮","🎧","🎵","🎸","🎨","♟️","🏆","🥇","🎬","📷"]],
    ["Outros", ["🚀","🌍","🧭","🗺️","🏁","🚩","🎉","🎊","✨","💥","👍","👏","🙌","🤝","🙏","👀","💪"]],
  ];

  let lastEditable = null;
  let lastRange = null;
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const node = sel.anchorNode;
    const host = node ? (node.nodeType === 1 ? node : node.parentElement) : null;
    const textEl = host && host.closest ? host.closest(".block-text") : null;
    if (textEl) { lastEditable = textEl; lastRange = sel.getRangeAt(0).cloneRange(); }
  });

  let emojiPanel = null;
  function closeEmojiPicker() {
    if (emojiPanel) { emojiPanel.remove(); emojiPanel = null; }
  }
  function openEmojiPicker(anchorEl, onPick) {
    closeEmojiPicker();
    const panel = document.createElement("div");
    panel.className = "emoji-pop";
    EMOJI_GROUPS.forEach(([label, emojis]) => {
      const h = document.createElement("p");
      h.className = "emoji-group-label";
      h.textContent = label;
      panel.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "emoji-grid";
      emojis.forEach((em) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "emoji-cell";
        b.textContent = em;
        b.title = em;
        b.addEventListener("mousedown", (e) => {
          e.preventDefault();
          closeEmojiPicker();
          onPick(em);
        });
        grid.appendChild(b);
      });
      panel.appendChild(grid);
    });
    document.body.appendChild(panel);
    emojiPanel = panel;
    const r = anchorEl.getBoundingClientRect();
    const maxLeft = window.scrollX + document.documentElement.clientWidth - panel.offsetWidth - 12;
    const maxTop = window.scrollY + document.documentElement.clientHeight - panel.offsetHeight - 12;
    panel.style.left = Math.max(12, Math.min(window.scrollX + r.left, maxLeft)) + "px";
    panel.style.top = Math.max(12, Math.min(window.scrollY + r.bottom + 6, maxTop)) + "px";
  }

  function insertEmojiIntoText(emoji) {
    let target = lastEditable;
    let range = lastRange;
    if (!target || !document.body.contains(target)) {
      const all = blocksEl ? blocksEl.querySelectorAll(".block-text") : [];
      target = all.length ? all[all.length - 1] : null;
      range = null;
    }
    if (!target) return;
    target.focus();
    const sel = window.getSelection();
    if (range && target.contains(range.startContainer)) {
      sel.removeAllRanges(); sel.addRange(range);
    } else {
      range = document.createRange();
      range.selectNodeContents(target); range.collapse(false);
      sel.removeAllRanges(); sel.addRange(range);
    }
    const textNode = document.createTextNode(emoji);
    range.insertNode(textNode);
    range.setStartAfter(textNode); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
    lastEditable = target; lastRange = range.cloneRange();
    const blockEl = target.closest(".block");
    if (blockEl) saveBlock(blockEl.dataset.id, { text: target.textContent });
  }

  const emojiBtn = document.getElementById("emoji-insert");
  if (emojiBtn) {
    emojiBtn.addEventListener("click", () => openEmojiPicker(emojiBtn, insertEmojiIntoText));
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

  const delBtn = document.getElementById("delete-page");
  const delModal = document.getElementById("delete-modal");
  
  if (delModal) {
    const confirmBtn = document.getElementById("delete-confirm");
    const cancelBtn = document.getElementById("delete-cancel");
    
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        delModal.removeAttribute("data-target-id"); // fallback to current pageId
        delModal.style.display = "flex";
      });
    }
    
    cancelBtn.addEventListener("click", () => {
      delModal.style.display = "none";
    });
    
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Apagando...";
      const targetId = delModal.getAttribute("data-target-id") || pageId;
      try { 
        await api(pageUrl(targetId), "DELETE"); 
        if (targetId === pageId) {
          window.location.href = "/workspace/"; 
        } else {
          window.location.reload(); // Deletou outra pagina pela sidebar
        }
      }
      catch (err) { 
        console.error(err); 
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Apagar";
        delModal.style.display = "none";
      }
    });
  }

  const BLOCK_KINDS = [
    { kind: "paragraph", label: "Texto", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="13" y2="17"></line></svg>` },
    { kind: "heading1", label: "Título 1", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle">H1</text></svg>` },
    { kind: "heading2", label: "Título 2", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle">H2</text></svg>` },
    { kind: "heading3", label: "Título 3", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle">H3</text></svg>` },
    { kind: "todo", label: "Tarefa", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>` },
    { kind: "bullet", label: "Lista", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>` },
    { kind: "quote", label: "Citação", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>` },
    { kind: "code", label: "Código", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>` },
    { kind: "divider", label: "Divisor", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>` },
    { kind: "file", label: "Arquivo", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>` },
  ];

  function buildBlock(b) {
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.id = b.id;
    el.dataset.kind = b.kind;

    const controls = document.createElement("div");
    controls.className = "block-controls";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "block-add-btn";
    addBtn.setAttribute("aria-label", "Adicionar bloco");
    addBtn.title = "Adicionar bloco";
    addBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    controls.appendChild(addBtn);

    const dragBtn = document.createElement("button");
    dragBtn.type = "button";
    dragBtn.className = "block-drag-handle";
    dragBtn.setAttribute("aria-label", "Arrastar bloco");
    dragBtn.title = "Arrastar bloco";
    dragBtn.draggable = true;
    dragBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;
    controls.appendChild(dragBtn);

    el.appendChild(controls);

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
    } else if (b.kind === "file") {
      const fDiv = document.createElement("div");
      fDiv.className = "block-file";
      if (b.file_url) {
        const a = document.createElement("a");
        a.href = b.file_url;
        a.target = "_blank";
        a.className = "file-link";
        a.textContent = b.file_name || "Arquivo anexo";
        fDiv.appendChild(a);
      } else {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.className = "file-upload-input";
        inp.id = "file-upload-" + b.id;
        
        const lbl = document.createElement("label");
        lbl.className = "file-upload-label";
        lbl.htmlFor = inp.id;
        lbl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Clique para escolher um arquivo`;

        inp.addEventListener("change", async (e) => {
          if (!e.target.files.length) return;
          lbl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Enviando...`;
          const fd = new FormData();
          fd.append("file", e.target.files[0]);
          try {
            const data = await apiUpload(blockUrl(b.id), "POST", fd);
            const fresh = buildBlock(data);
            el.replaceWith(fresh);
          } catch (err) { console.error(err); lbl.textContent = "Erro ao enviar"; }
        });
        fDiv.appendChild(inp);
        fDiv.appendChild(lbl);
      }
      el.appendChild(fDiv);
    } else {
      const txt = document.createElement("div");
      txt.className = "block-text" + (b.kind === "todo" && b.checked ? " is-done" : "");
      txt.contentEditable = "true";
      txt.dataset.placeholder = "Escreva algo, ou aperte / para comandos";
      txt.textContent = b.text || "";
      el.appendChild(txt);
    }
    return el;
  }

  function blockOrder() {
    return Array.from(blocksEl.querySelectorAll(".block")).map((el) => Number(el.dataset.id));
  }

  const pushOrder = debounce(() => {
    api(reorderUrl(pageId), "POST", { order: blockOrder() }).catch(console.error);
  }, 300);

  // ---------- Block Drag & Drop ----------
  if (blocksEl) {
    let blockDraggedItem = null;

    blocksEl.addEventListener("dragstart", (e) => {
      const handle = e.target.closest(".block-drag-handle");
      if (!handle) {
        return;
      }
      blockDraggedItem = handle.closest(".block");
      if (blockDraggedItem) {
        blockDraggedItem.classList.add("dragging-block");
        try { e.dataTransfer.effectAllowed = "move"; } catch (_) {}
      }
    });

    blocksEl.addEventListener("dragover", (e) => {
      if (!blockDraggedItem) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "move"; } catch (_) {}
      const targetBlock = e.target.closest(".block");
      if (targetBlock && targetBlock !== blockDraggedItem) {
        const rect = targetBlock.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y < rect.height / 2) {
          targetBlock.parentNode.insertBefore(blockDraggedItem, targetBlock);
        } else {
          targetBlock.parentNode.insertBefore(blockDraggedItem, targetBlock.nextSibling);
        }
      }
    });

    blocksEl.addEventListener("dragend", (e) => {
      if (blockDraggedItem) {
        blockDraggedItem.classList.remove("dragging-block");
        blockDraggedItem = null;
        pushOrder();
      }
    });
  }

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
    if (kind === "file") {
      createBlockAfter(fresh, "paragraph");
    } else {
      const t = fresh.querySelector(".block-text");
      if (t) focusEnd(t);
    }
  }

  async function deleteBlock(blockEl) {
    const id = blockEl.dataset.id;
    const next = blockEl.nextElementSibling;
    const prev = blockEl.previousElementSibling;
    blockEl.classList.add("deleting-block");
    setTimeout(async () => {
      blockEl.remove();
      try { await api(blockUrl(id), "DELETE"); pushOrder(); }
      catch (err) { console.error(err); }
      const focusTarget = next || prev;
      const text = focusTarget ? focusTarget.querySelector(".block-text") : null;
      if (text) focusEnd(text);
    }, 200);
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
    if (t.innerHTML === "<br>" || t.textContent.trim() === "") {
      t.innerHTML = "";
    }
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
      if (action === "delete") deleteBlock(blockEl);
      return;
    }

    const addBtn = e.target.closest(".block-add-btn");
    if (addBtn) {
      const blockEl = addBtn.closest(".block");
      const r = addBtn.getBoundingClientRect();
      openBlockMenu(blockEl, r.left, r.bottom + 4);
      return;
    }
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
      b.innerHTML = `<span class="bm-ic">${item.icon}</span> <span class="bm-tx">${item.label}</span>`;
      b.addEventListener("mousedown", (ev) => { ev.preventDefault(); pickSlash(i); });
      slashMenu.appendChild(b);
    });
    const sel = slashMenu.querySelector(".is-sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function updateSlashSelection() {
    const buttons = slashMenu.querySelectorAll(".slash-item");
    buttons.forEach((b, i) => {
      if (i === slashSel) {
        b.classList.add("is-sel");
        b.scrollIntoView({ block: "nearest" });
      } else {
        b.classList.remove("is-sel");
      }
    });
  }

  function handleSlashNav(e) {
    if (e.key === "Escape") { e.preventDefault(); closeSlash(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); slashSel = (slashSel + 1) % slashItems.length; updateSlashSelection(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); slashSel = (slashSel - 1 + slashItems.length) % slashItems.length; updateSlashSelection(); return; }
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

  function menuButton(label, icon, action, danger) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "block-menu-item" + (danger ? " danger" : "");
    btn.innerHTML = `<span class="bm-ic">${icon}</span> <span class="bm-tx">${label}</span>`;
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

    const icDup = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const icAdd = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    const icDel = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

    blockMenu.appendChild(menuButton("Duplicar", icDup, duplicateBlock));
    blockMenu.appendChild(menuButton("Adicionar abaixo", icAdd, (b) => createBlockAfter(b, "paragraph")));
    blockMenu.appendChild(menuDivider());
    BLOCK_KINDS.forEach((item) => {
      blockMenu.appendChild(menuButton("Transformar em " + item.label, item.icon, (b) => setKind(b, item.kind)));
    });
    blockMenu.appendChild(menuDivider());
    blockMenu.appendChild(menuButton("Apagar bloco", icDel, deleteBlock, true));

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
    if (blockMenu && !blockMenu.contains(e.target) && !e.target.closest(".block-add-btn")) closeBlockMenu();
    if (emojiPanel && !emojiPanel.contains(e.target)
        && !e.target.closest("#emoji-insert") && !e.target.closest("#page-icon")) closeEmojiPicker();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSlash();
      closeBlockMenu();
      closeEmojiPicker();
    }
  });

  function initSidebarToggle() { /* reserved for menu button on small screens */ }
  initSidebarToggle();
})();
