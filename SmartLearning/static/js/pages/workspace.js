/* SmartLearning workspace — editor de blocos estilo Notion.
   JS puro, sem build. Conversa com a API JSON em /workspace/api/. */
(function () {
  "use strict";

  function getCookie(name) {
    const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? m.pop() : "";
  }
  const CSRF = getCookie("csrftoken");

  const api = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
    return res.status === 204 ? {} : res.json();
  };

  const apiUpload = async (url, method, formData) => {
    const res = await fetch(url, {
      method,
      headers: {
        "X-CSRFToken": CSRF,
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
    return res.status === 204 ? {} : res.json();
  };

  const debounce = (fn, ms) => {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  // Posiciona um painel flutuante sem sair da viewport.
  const placeFloatingPanel = (panel, left, top, margin) => {
    const maxLeft = window.scrollX + document.documentElement.clientWidth - panel.offsetWidth - margin;
    const maxTop = window.scrollY + document.documentElement.clientHeight - panel.offsetHeight - margin;
    panel.style.left = `${Math.max(margin, Math.min(left, maxLeft))}px`;
    panel.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
  };

  const pane = document.getElementById("editor-pane");
  const PAGES_URL = pane ? pane.dataset.apiPages : "/workspace/api/pages/";
  // Estado por página: re-lido por initEditor() a cada navegação SPA.
  let pageId = pane && pane.dataset.pageId ? pane.dataset.pageId : null;

  const pageUrl = (id) => PAGES_URL + id + "/";
  const blocksUrl = (id) => PAGES_URL + id + "/blocks/";
  const reorderUrl = (id) => PAGES_URL + id + "/reorder/";
  const blockUrl = (id) => "/workspace/api/blocks/" + id + "/";
  const moveUrl = (id) => PAGES_URL + id + "/move/";

  // Linhas de uma página na sidebar (árvore + favoritos), com seletor opcional.
  const treeRowEls = (pid, sel) =>
    document.querySelectorAll(`.sidebar .tree-row[data-page-id="${pid}"]${sel ? ` ${sel}` : ""}`);

  // Replica título/ícone nas cópias visíveis; pula o editor se ele for a origem.
  const syncTitleCopies = (pid, title, sourceEl = null) => {
    treeRowEls(pid, ".tree-title").forEach((el) => { el.textContent = title; });
    if (String(pid) !== String(pageId)) return;
    const docTitle = document.getElementById("page-title");
    if (docTitle && docTitle !== sourceEl) docTitle.textContent = title;
    const crumb = pane.querySelector(".crumb.is-current .crumb-tx");
    if (crumb) crumb.textContent = title;
  };

  const syncIconCopies = (pid, icon) => {
    treeRowEls(pid, ".tree-icon").forEach((el) => { el.textContent = icon; });
    if (String(pid) !== String(pageId)) return;
    const crumbIc = pane.querySelector(".crumb.is-current .crumb-ic");
    if (crumbIc) crumbIc.textContent = icon;
  };

  const createPage = async (parent, title, icon, is_folder = false) => {
    const payload = {};
    if (parent) payload.parent = parent;
    if (title) payload.title = title;
    if (icon) payload.icon = icon;
    if (is_folder) payload.is_folder = true;
    
    try {
      const data = await api(PAGES_URL, "POST", payload);
      window.location.href = `/workspace/p/${data.id}/`;
    } catch (err) {
      alert(`Erro ao criar: ${err.message}`);
      console.error(err);
    }
  };

  const inlineNewBtn = document.getElementById("inline-new-page");
  if (inlineNewBtn) inlineNewBtn.addEventListener("click", () => createPage(null));

  const ctxMenu = document.getElementById("pages-context-menu");
  const sidebarScroll = document.querySelector(".sidebar-scroll");

  let ctxTargetPageId = null;

  // ---------- Renomear página/pasta na árvore (inline) ----------
  const startTreeRename = (pid) => {
    const row = sidebarScroll
      ? sidebarScroll.querySelector(`.tree-row[data-page-id="${pid}"]`)
      : null;
    const titleEl = row ? row.querySelector(".tree-title") : null;
    if (!titleEl || row.querySelector(".tree-rename-input")) return;

    const oldTitle = titleEl.textContent;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tree-rename-input";
    input.value = oldTitle;
    input.maxLength = 200;
    input.setAttribute("aria-label", "Novo nome");
    row.setAttribute("draggable", "false"); // sem drag durante a edição
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = async (commit) => {
      if (finished) return;
      finished = true;
      const name = input.value.trim();
      input.replaceWith(titleEl);
      row.setAttribute("draggable", "true");
      if (!commit || !name || name === oldTitle) return;
      try {
        const data = await api(pageUrl(pid), "PATCH", { title: name });
        syncTitleCopies(pid, data.title);
      } catch (err) { console.error(err); }
    };

    // Impede que o clique siga o link da árvore.
    input.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
  };

  if (ctxMenu && sidebarScroll) {
    sidebarScroll.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      
      const treeRow = e.target.closest(".tree-row");
      const ctxDivider = document.getElementById("ctx-divider");
      const ctxRename = document.getElementById("ctx-rename-page");
      const ctxDelete = document.getElementById("ctx-delete-page");

      if (treeRow) {
        ctxTargetPageId = treeRow.getAttribute("data-page-id");
        const isFolder = treeRow.getAttribute("data-is-folder") === "true";
        if (ctxDivider) ctxDivider.style.display = "block";
        if (ctxRename) ctxRename.style.display = "flex";
        if (ctxDelete) ctxDelete.style.display = "flex";

        const ctxNewPage = document.getElementById("ctx-new-page");
        const ctxNewFolder = document.getElementById("ctx-new-folder");
        if (ctxNewPage) ctxNewPage.style.display = isFolder ? "flex" : "none";
        if (ctxNewFolder) ctxNewFolder.style.display = isFolder ? "flex" : "none";

      } else {
        ctxTargetPageId = null;
        if (ctxDivider) ctxDivider.style.display = "none";
        if (ctxRename) ctxRename.style.display = "none";
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
    
    const ctxRename = document.getElementById("ctx-rename-page");
    if (ctxRename) ctxRename.addEventListener("click", () => {
      ctxMenu.style.display = "none";
      if (ctxTargetPageId) startTreeRename(ctxTargetPageId);
    });

    const ctxDelete = document.getElementById("ctx-delete-page");
    if (ctxDelete) ctxDelete.addEventListener("click", () => {
      ctxMenu.style.display = "none";
      if (ctxTargetPageId) {
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

    const inSidebar = (el) => el && el.closest(".sidebar-scroll");

    const clearMarks = () => {
      sidebar.querySelectorAll(".dnd-before,.dnd-after,.dnd-inside")
        .forEach((el) => el.classList.remove("dnd-before", "dnd-after", "dnd-inside"));
      sidebar.querySelectorAll(".dnd-root")
        .forEach((el) => el.classList.remove("dnd-root"));
    };

    const rowOf = (target) => {
      const row = target.closest ? target.closest(".tree-row") : null;
      return row && inSidebar(row) ? row : null;
    };

    const zoneFor = (row, e) => {
      const r = row.getBoundingClientRect();
      const y = e.clientY - r.top;
      if (y < r.height * 0.28) return "before";
      if (y > r.height * 0.72) return "after";
      return "inside";
    };

    const siblingIds = (ul) => {
      return Array.from(ul.children)
        .filter((li) => li.classList.contains("tree-item"))
        .map((li) => li.querySelector(":scope > .tree-row").dataset.pageId);
    };

    const movePage = async (body) => {
      try {
        await api(moveUrl(draggedId), "POST", body);
        window.location.reload();
      } catch (err) { console.error(err); clearMarks(); }
    };

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
          clearMarks(); movePage({ parent: targetId }); return; 
        }
        const parentUl = item.parentElement;
        const parentItem = parentUl.closest(".tree-item");
        const parentId = parentItem
          ? parentItem.querySelector(":scope > .tree-row").dataset.pageId : null;
        let ids = siblingIds(parentUl).filter((id) => id !== draggedId);
        const idx = ids.indexOf(targetId);
        ids.splice(zone === "before" ? idx : idx + 1, 0, draggedId);
        clearMarks();
        movePage({ parent: parentId, order: ids });
      } else if (e.target.closest && e.target.closest(".sidebar-scroll")) {
        clearMarks();
        movePage({ parent: null });
      } else {
        clearMarks();
      }
    });
  })();

  // ---------- Árvore: abrir/fechar pastas (subpáginas) ----------
  // Preenchidas abaixo; usadas pela navegação SPA.
  let revealActiveTreeRow = () => {};
  let applyTreeCollapse = () => {};
  (function initTreeCollapse() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const KEY = "ws-tree-collapsed";
    let collapsed = new Set();
    try { collapsed = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch (_) {}

    const persist = () => {
      try { localStorage.setItem(KEY, JSON.stringify([...collapsed])); } catch (_) {}
    };

    const setState = (item, isCollapsed) => {
      const id = item.dataset.pageId;
      item.classList.toggle("is-collapsed", isCollapsed);
      const toggle = item.querySelector(":scope > .tree-row [data-tree-toggle]");
      if (toggle) toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      if (id) { if (isCollapsed) collapsed.add(id); else collapsed.delete(id); }
    };

    // Aplica os estados salvos (também após trocas de DOM da sidebar).
    applyTreeCollapse = () => {
      sidebar.querySelectorAll(".tree-item.has-children").forEach((item) => {
        if (collapsed.has(item.dataset.pageId)) setState(item, true);
      });
    };
    applyTreeCollapse();

    // A página aberta nunca fica escondida: expande todos os ancestrais.
    revealActiveTreeRow = () => {
      const active = sidebar.querySelector(".tree-row.is-active");
      if (!active) return;
      const self = active.closest(".tree-item");
      let node = self ? self.parentElement.closest(".tree-item") : null;
      while (node) {
        setState(node, false);
        node = node.parentElement.closest(".tree-item");
      }
      persist();
    };
    revealActiveTreeRow();

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
    const listEl = drawer.querySelector(".tasks-list");
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

    // Sincroniza abas/chips/link "nova"; não mexe na visibilidade.
    const syncFilterControls = () => {
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
          newLink.href = `${u.pathname}?${u.searchParams.toString()}`;
        } catch (_) {}
      }
    };

    // Mostra/esconde itens; roda só ao abrir a gaveta ou trocar de filtro.
    const applyFilter = () => {
      let visible = 0;
      items.forEach((el) => {
        const show = el.dataset.category === cat
          && (!subject || el.dataset.subject === subject)
          && !(isDone(el) && !showAll);
        el.hidden = !show;
        if (show) visible++;
      });
      if (emptyEl) emptyEl.hidden = visible !== 0;
    };

    // Contadores das abas + badge da barra lateral (refletem pendentes).
    const updateCounts = () => {
      tabs.forEach((t) => {
        const c = t.dataset.taskCat;
        const n = items.filter(
          (el) => el.dataset.category === c && !(isDone(el) && !showAll)
        ).length;
        const tabBadge = t.querySelector(".tasks-count");
        if (tabBadge) tabBadge.textContent = n;
      });
      updateBadge();
    };

    // Agrupa itens visíveis por prazo (estilo Todoist) e insere cabeçalhos.
    const GROUPS = [
      { key: "overdue", label: "Atrasadas" },
      { key: "today", label: "Hoje" },
      { key: "week", label: "Próximos 7 dias" },
      { key: "later", label: "Depois" },
      { key: "nodate", label: "Sem prazo" },
      { key: "done", label: "Concluídas" },
    ];
    const GROUP_ORDER = Object.fromEntries(GROUPS.map((g, i) => [g.key, i]));

    const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    const bucketOf = (el, today) => {
      if (isDone(el)) return "done";
      const due = el.dataset.due;
      if (!due) return "nodate";
      const diff = Math.round((new Date(`${due}T00:00:00`) - today) / 86400000);
      if (diff < 0) return "overdue";
      if (diff === 0) return "today";
      if (diff <= 7) return "week";
      return "later";
    };
    const titleOf = (el) => {
      const t = el.querySelector(".tasks-item-title");
      return t ? t.textContent : "";
    };

    const groupAndOrder = () => {
      if (!listEl) return;
      listEl.querySelectorAll(".tasks-group").forEach((h) => h.remove());

      // Calcula o balde uma vez por item (evita reparsear datas no sort).
      const today = startOfToday();
      const rows = items
        .filter((el) => !el.hidden)
        .map((el) => ({ el, bucket: bucketOf(el, today), due: el.dataset.due || "", title: titleOf(el) }));

      const counts = {};
      rows.forEach((r) => { counts[r.bucket] = (counts[r.bucket] || 0) + 1; });

      rows.sort((a, b) => {
        if (a.bucket !== b.bucket) return GROUP_ORDER[a.bucket] - GROUP_ORDER[b.bucket];
        if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
        if (!a.due !== !b.due) return a.due ? -1 : 1;   // com prazo antes de sem prazo
        return a.title.localeCompare(b.title);
      });

      let current = null;
      rows.forEach(({ el, bucket }) => {
        if (bucket !== current) {
          current = bucket;
          const g = GROUPS.find((x) => x.key === bucket);
          const h = document.createElement("div");
          h.className = `tasks-group${bucket === "overdue" ? " is-overdue" : ""}`;
          h.innerHTML = '<span class="tasks-group-label"></span><span class="tasks-group-count"></span>';
          h.querySelector(".tasks-group-label").textContent = g ? g.label : bucket;
          h.querySelector(".tasks-group-count").textContent = counts[bucket];
          listEl.insertBefore(h, emptyEl);
        }
        listEl.insertBefore(el, emptyEl);
      });
    };

    const render = () => { syncFilterControls(); applyFilter(); groupAndOrder(); updateCounts(); };

    const updateBadge = () => {
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
    };

    // Reveal escalonado dos itens visíveis (entrada da gaveta / troca de filtro).
    const revealItems = () => {
      const ordered = listEl
        ? Array.from(listEl.querySelectorAll(".tasks-item:not([hidden])"))
        : items.filter((el) => !el.hidden);
      ordered.forEach((el, i) => {
        el.classList.remove("reveal");
        void el.offsetWidth;
        el.style.animationDelay = `${Math.min(i, 12) * 38}ms`;
        el.classList.add("reveal");
      });
    };
    const clearReveal = () => {
      items.forEach((el) => { el.classList.remove("reveal"); el.style.animationDelay = ""; });
    };

    // Toggle/excluir via fetch, sem recarregar (os <form> seguem como fallback).
    const postForm = async (form) => {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "X-CSRFToken": CSRF },
        body: new FormData(form),
      });
      return res.ok;
    };

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
        // Concluída: pisca verde e segue visível até reabrir/recarregar.
        if (nowDone) { item.classList.remove("just-completed"); void item.offsetWidth; item.classList.add("just-completed"); }
        updateCounts(); saveFilters();
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

    const saveFilters = () => {
      try {
        localStorage.setItem(STORE_CAT, cat);
        localStorage.setItem(STORE_SUB, subject);
        localStorage.setItem(STORE_ALL, showAll ? "1" : "0");
      } catch (_) {}
    };

    let lastFocus = null;
    const openDrawer = () => {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      // Reabrir = refiltrar: concluídas da sessão anterior somem agora.
      render();
      // Próximo frame: transição de entrada + reveal escalonado.
      requestAnimationFrame(() => { drawer.classList.add("is-open"); revealItems(); });
      openBtn.setAttribute("aria-expanded", "true");
      const close = drawer.querySelector(".tasks-close");
      if (close) close.focus();
    };
    const closeDrawer = () => {
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
    };

    openBtn.addEventListener("click", openDrawer);
    closeEls.forEach((el) => el.addEventListener("click", closeDrawer));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !drawer.hidden) closeDrawer();
    });

    const revealIfOpen = () => { if (!drawer.hidden) revealItems(); };
    tabs.forEach((t) => t.addEventListener("click", () => { cat = t.dataset.taskCat; render(); saveFilters(); revealIfOpen(); }));
    chips.forEach((c) => c.addEventListener("click", () => { subject = c.dataset.taskSubject; render(); saveFilters(); revealIfOpen(); }));
    if (showAllBtn) showAllBtn.addEventListener("click", () => { showAll = !showAll; render(); saveFilters(); revealIfOpen(); });

    render();

    // ?tasks=open abre a gaveta; ?cat=prova|trabalho seleciona a aba.
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("tasks") === "open") {
      const wantCat = qs.get("cat");
      if (wantCat && tabs.some((t) => t.dataset.taskCat === wantCat)) { cat = wantCat; saveFilters(); }
      openDrawer();
    }
  })();

  let blocksEl = null;   // #blocks da página aberta (atualizado pelo initEditor)

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
  const closeEmojiPicker = () => {
    if (emojiPanel) { emojiPanel.remove(); emojiPanel = null; }
  };
  const openEmojiPicker = (anchorEl, onPick) => {
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
    placeFloatingPanel(panel, window.scrollX + r.left, window.scrollY + r.bottom + 6, 12);
  };

  const insertEmojiIntoText = (emoji) => {
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
  };

  const delModal = document.getElementById("delete-modal");

  if (delModal) {
    const confirmBtn = document.getElementById("delete-confirm");
    const cancelBtn = document.getElementById("delete-cancel");

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
          window.location.reload(); // Apagou outra página pela barra lateral
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

  // ---------- Matéria vinculada (chip + picker) ----------
  const SUBJECTS = (() => {
    const el = document.getElementById("ws-subjects");
    try { return el ? JSON.parse(el.textContent) : []; } catch (_) { return []; }
  })();
  let currentSubjectId = null;
  let subjectChip = null;

  let subjectMenu = null;
  let subjectMenuAnchor = null;
  const closeSubjectMenu = () => {
    if (!subjectMenu) return;
    const hadFocus = subjectMenu.contains(document.activeElement);
    subjectMenu.remove();
    subjectMenu = null;
    if (subjectChip) subjectChip.setAttribute("aria-expanded", "false");
    // Devolve o foco a quem abriu o menu (chip ou bloco do slash).
    if (hadFocus && subjectMenuAnchor && document.contains(subjectMenuAnchor)) {
      subjectMenuAnchor.focus();
    }
    subjectMenuAnchor = null;
  };

  const updateSubjectChip = (subject) => {
    currentSubjectId = subject ? subject.id : null;
    if (!subjectChip) return;
    subjectChip.classList.toggle("is-empty", !subject);
    const dot = document.getElementById("page-subject-dot");
    const name = document.getElementById("page-subject-name");
    if (dot) { dot.hidden = !subject; if (subject) dot.style.background = subject.color; }
    if (name) name.textContent = subject ? subject.name : "Vincular matéria";
  };

  // Ponto colorido da página na árvore/favoritos, sem recarregar.
  const syncTreeDot = (subject) => {
    treeRowEls(pageId).forEach((row) => {
      let dot = row.querySelector(".tree-dot");
      if (!subject) { if (dot) dot.remove(); return; }
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "tree-dot";
        const icon = row.querySelector(".tree-icon");
        if (icon) icon.before(dot);
      }
      dot.style.background = subject.color;
      dot.title = subject.name;
    });
  };

  const setPageSubject = async (subjectId) => {
    try {
      const data = await api(pageUrl(pageId), "PATCH", { subject: subjectId });
      updateSubjectChip(data.subject);
      syncTreeDot(data.subject);
    } catch (err) { console.error(err); }
  };

  const subjectMenuItem = (label, onPick, opts = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `block-menu-item${opts.selected ? " is-sel" : ""}${opts.danger ? " danger" : ""}`;
    btn.setAttribute("role", "menuitem");
    btn.innerHTML = `<span class="bm-ic">${opts.iconHtml || ""}</span> <span class="bm-tx"></span>`;
    btn.querySelector(".bm-tx").textContent = label;
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // não rouba o foco
    btn.addEventListener("click", () => { closeSubjectMenu(); onPick(); });
    return btn;
  };

  const openSubjectPicker = (anchorEl) => {
    closeSubjectMenu();
    const panel = document.createElement("div");
    panel.className = "block-menu subject-menu";
    panel.setAttribute("role", "menu");
    panel.setAttribute("aria-label", "Vincular matéria");

    if (!SUBJECTS.length) {
      const p = document.createElement("p");
      p.className = "subject-menu-empty";
      p.textContent = "Nenhuma matéria cadastrada. Crie uma na tela Matérias.";
      panel.appendChild(p);
    }
    SUBJECTS.forEach((s) => {
      panel.appendChild(subjectMenuItem(s.name, () => setPageSubject(s.id), {
        selected: s.id === currentSubjectId,
        iconHtml: `<span class="subject-dot" style="background:${s.color}"></span>`,
      }));
    });
    if (currentSubjectId) {
      panel.appendChild(menuDivider());
      const icUnlink = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.84 12.25 21 10.09a5 5 0 0 0-7.07-7.07l-1.27 1.27"></path><path d="m5.17 11.75-2.18 2.16a5 5 0 0 0 7.07 7.07l1.27-1.27"></path><line x1="8" y1="2" x2="8" y2="5"></line><line x1="2" y1="8" x2="5" y2="8"></line><line x1="16" y1="19" x2="16" y2="22"></line><line x1="19" y1="16" x2="22" y2="16"></line></svg>`;
      panel.appendChild(subjectMenuItem("Remover vínculo", () => setPageSubject(null), {
        danger: true,
        iconHtml: icUnlink,
      }));
    }

    panel.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = Array.from(panel.querySelectorAll(".block-menu-item"));
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next].focus();
    });

    document.body.appendChild(panel);
    subjectMenu = panel;
    subjectMenuAnchor = anchorEl;
    const r = anchorEl.getBoundingClientRect();
    placeFloatingPanel(panel, window.scrollX + r.left, window.scrollY + r.bottom + 6, 10);
    if (subjectChip && anchorEl === subjectChip) subjectChip.setAttribute("aria-expanded", "true");
    const first = panel.querySelector(".block-menu-item");
    if (first) first.focus();
  };

  const BLOCK_KINDS = [
    { kind: "paragraph", label: "Texto", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="13" y2="17"></line></svg>` },
    { kind: "heading1", label: "Título 1", keywords: "titulo h1", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle">H1</text></svg>` },
    { kind: "heading2", label: "Título 2", keywords: "titulo h2", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle">H2</text></svg>` },
    { kind: "heading3", label: "Título 3", keywords: "titulo h3", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle">H3</text></svg>` },
    { kind: "bullet", label: "Lista", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>` },
    { kind: "todo", label: "Tarefa", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>` },
    { kind: "quote", label: "Citação", keywords: "citacao", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>` },
    { kind: "code", label: "Código", keywords: "codigo", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>` },
    { kind: "file", label: "Arquivo", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>` },
    { kind: "divider", label: "Divisor", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>` },
  ];

  // Comandos do slash que não viram bloco (têm run em vez de kind).
  const SLASH_ACTIONS = [
    {
      label: "Matéria",
      keywords: "materia vincular",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>`,
      run: (blockEl) => openSubjectPicker(blockEl.querySelector(".block-text") || blockEl),
    },
  ];
  const SLASH_ITEMS = [...BLOCK_KINDS, ...SLASH_ACTIONS];

  const blockControlsEl = () => {
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
    return controls;
  };

  // Corpo de bloco "arquivo": link quando já enviado, upload quando vazio.
  const fileBlockEl = (b) => {
    const fDiv = document.createElement("div");
    fDiv.className = "block-file";
    if (b.file_url) {
      const a = document.createElement("a");
      a.href = b.file_url;
      a.target = "_blank";
      a.className = "file-link";
      a.textContent = b.file_name || "Arquivo anexo";
      fDiv.appendChild(a);
      return fDiv;
    }

    const inp = document.createElement("input");
    inp.type = "file";
    inp.className = "file-upload-input";
    inp.id = `file-upload-${b.id}`;

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
        const blockEl = fDiv.closest(".block");
        if (blockEl) blockEl.replaceWith(buildBlock(data));
      } catch (err) { console.error(err); lbl.textContent = "Erro ao enviar"; }
    });
    fDiv.appendChild(inp);
    fDiv.appendChild(lbl);
    return fDiv;
  };

  const buildBlock = (b) => {
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.id = b.id;
    el.dataset.kind = b.kind;
    el.appendChild(blockControlsEl());

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
      el.appendChild(fileBlockEl(b));
    } else {
      const txt = document.createElement("div");
      txt.className = `block-text${b.kind === "todo" && b.checked ? " is-done" : ""}`;
      txt.contentEditable = "true";
      txt.dataset.placeholder = "Escreva algo, ou aperte / para comandos";
      txt.textContent = b.text || "";
      el.appendChild(txt);
    }
    return el;
  };

  const blockOrder = () => Array.from(blocksEl.querySelectorAll(".block")).map((el) => Number(el.dataset.id));

  const saveBlockOrder = debounce(() => {
    api(reorderUrl(pageId), "POST", { order: blockOrder() }).catch(console.error);
  }, 300);

  // ---------- Block Drag & Drop (religado pelo initEditor a cada página) ----------
  const bindBlockDnD = () => {
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
        saveBlockOrder();
      }
    });
  };

  const focusEnd = (el) => {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // Um timer por bloco: editar outro bloco não cancela o save anterior.
  const pendingBlockSaves = new Map();   // id -> { timer, patch }
  const saveBlock = (id, patch) => {
    const prev = pendingBlockSaves.get(id);
    if (prev) clearTimeout(prev.timer);
    const timer = setTimeout(() => {
      pendingBlockSaves.delete(id);
      api(blockUrl(id), "PATCH", patch).catch(console.error);
    }, 500);
    pendingBlockSaves.set(id, { timer, patch });
  };

  let flushTitleSave = null;   // definida pelo initEditor quando há título editável

  // Antes de trocar de página: descarrega saves pendentes (não perde digitação).
  const flushPendingSaves = () => {
    pendingBlockSaves.forEach(({ timer, patch }, id) => {
      clearTimeout(timer);
      api(blockUrl(id), "PATCH", patch).catch(console.error);
    });
    pendingBlockSaves.clear();
    if (flushTitleSave) flushTitleSave();
  };

  const createBlockAfter = async (afterEl, kind) => {
    const host = blocksEl;   // a navegação SPA pode trocar o DOM durante o POST
    const data = await api(blocksUrl(pageId), "POST", { kind: kind || "paragraph", text: "" });
    if (!host || !host.isConnected || (afterEl && !afterEl.isConnected)) return null;
    const el = buildBlock(data);
    if (afterEl && afterEl.nextSibling) host.insertBefore(el, afterEl.nextSibling);
    else host.appendChild(el);
    saveBlockOrder();
    const text = el.querySelector(".block-text");
    if (text) focusEnd(text);
    return el;
  };

  const addBlockAtEnd = async () => createBlockAfter(blocksEl.lastElementChild, "paragraph");

  const setBlockKind = async (blockEl, kind) => {
    const id = blockEl.dataset.id;
    const textEl = blockEl.querySelector(".block-text");
    const text = textEl ? textEl.textContent : "";
    await api(blockUrl(id), "PATCH", { kind, text, checked: false });
    const fresh = buildBlock({ id, kind, text, checked: false });
    blockEl.replaceWith(fresh);
    if (kind === "file") {
      createBlockAfter(fresh, "paragraph");
    } else {
      const t = fresh.querySelector(".block-text");
      if (t) focusEnd(t);
    }
  };

  const deleteBlock = async (blockEl) => {
    const id = blockEl.dataset.id;
    const next = blockEl.nextElementSibling;
    const prev = blockEl.previousElementSibling;
    blockEl.classList.add("deleting-block");
    setTimeout(async () => {
      blockEl.remove();
      try { await api(blockUrl(id), "DELETE"); saveBlockOrder(); }
      catch (err) { console.error(err); }
      const focusTarget = next || prev;
      const text = focusTarget ? focusTarget.querySelector(".block-text") : null;
      if (text) focusEnd(text);
    }, 200);
  };

  const duplicateBlock = async (blockEl) => {
    const host = blocksEl;   // a navegação SPA pode trocar o DOM durante o POST
    const text = blockEl.querySelector(".block-text");
    const data = await api(blocksUrl(pageId), "POST", {
      kind: blockEl.dataset.kind,
      text: text ? text.textContent : "",
    });
    if (!host || !host.isConnected || !blockEl.isConnected) return;
    const fresh = buildBlock(data);
    if (blockEl.nextSibling) host.insertBefore(fresh, blockEl.nextSibling);
    else host.appendChild(fresh);
    saveBlockOrder();
    const target = fresh.querySelector(".block-text");
    if (target) focusEnd(target);
  };

  // ---------- Eventos do editor de blocos (religados pelo initEditor) ----------
  const onBlockInput = (e) => {
    const t = e.target;
    if (!t.classList.contains("block-text")) return;
    if (t.innerHTML === "<br>" || t.textContent.trim() === "") {
      t.innerHTML = "";
    }
    const blockEl = t.closest(".block");
    maybeOpenSlashMenu(t, blockEl);
    saveBlock(blockEl.dataset.id, { text: t.textContent });
  };

  const onBlockChange = (e) => {
    if (!e.target.classList.contains("todo-check")) return;
    const blockEl = e.target.closest(".block");
    const checked = e.target.checked;
    const text = blockEl.querySelector(".block-text");
    if (text) text.classList.toggle("is-done", checked);
    api(blockUrl(blockEl.dataset.id), "PATCH", { checked: checked }).catch(console.error);
  };

  const onBlockKeydown = (e) => {
    const t = e.target;
    if (!t.classList.contains("block-text")) return;
    const blockEl = t.closest(".block");

    if (slashOpen && ["ArrowDown", "ArrowUp", "Enter", "Escape"].indexOf(e.key) !== -1) {
      handleSlashMenuKeys(e);
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
  };

  const onBlockClick = (e) => {
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
  };

  const bindBlockEvents = () => {
    blocksEl.addEventListener("input", onBlockInput);
    blocksEl.addEventListener("change", onBlockChange);
    blocksEl.addEventListener("keydown", onBlockKeydown);
    blocksEl.addEventListener("click", onBlockClick);
  };

  let slashOpen = false;
  let slashMenu = null;
  let slashBlock = null;
  let slashSel = 0;
  let slashItems = [];

  const maybeOpenSlashMenu = (textEl, blockEl) => {
    const val = textEl.textContent;
    if (val.charAt(0) === "/") {
      openSlashMenu(textEl, blockEl, val.slice(1).toLowerCase());
    } else if (slashOpen) {
      closeSlashMenu();
    }
  };

  const openSlashMenu = (textEl, blockEl, query) => {
    slashItems = SLASH_ITEMS.filter(
      (k) => `${k.label} ${k.keywords || ""}`.toLowerCase().indexOf(query) !== -1
    );
    if (!slashItems.length) { closeSlashMenu(); return; }
    if (!slashMenu) {
      slashMenu = document.createElement("div");
      slashMenu.className = "slash-menu";
      document.body.appendChild(slashMenu);
    }
    slashBlock = blockEl;
    slashSel = 0;
    renderSlashMenu();
    const r = textEl.getBoundingClientRect();
    slashMenu.style.left = `${window.scrollX + r.left}px`;
    slashMenu.style.top = `${window.scrollY + r.bottom + 4}px`;
    slashOpen = true;
  };

  const renderSlashMenu = () => {
    slashMenu.innerHTML = "";
    slashItems.forEach((item, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `slash-item${i === slashSel ? " is-sel" : ""}`;
      b.innerHTML = `<span class="bm-ic">${item.icon}</span> <span class="bm-tx">${item.label}</span>`;
      b.addEventListener("mousedown", (ev) => { ev.preventDefault(); pickSlashItem(i); });
      slashMenu.appendChild(b);
    });
    const sel = slashMenu.querySelector(".is-sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  };

  const updateSlashSelection = () => {
    const buttons = slashMenu.querySelectorAll(".slash-item");
    buttons.forEach((b, i) => {
      if (i === slashSel) {
        b.classList.add("is-sel");
        b.scrollIntoView({ block: "nearest" });
      } else {
        b.classList.remove("is-sel");
      }
    });
  };

  const handleSlashMenuKeys = (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeSlashMenu(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); slashSel = (slashSel + 1) % slashItems.length; updateSlashSelection(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); slashSel = (slashSel - 1 + slashItems.length) % slashItems.length; updateSlashSelection(); return; }
    if (e.key === "Enter") { e.preventDefault(); pickSlashItem(slashSel); }
  };

  const pickSlashItem = (i) => {
    const item = slashItems[i];
    const blockEl = slashBlock;
    closeSlashMenu();
    if (!item || !blockEl) return;
    const textEl = blockEl.querySelector(".block-text");
    if (textEl) { textEl.textContent = ""; saveBlock(blockEl.dataset.id, { text: "" }); }
    if (item.run) { item.run(blockEl); return; }
    setBlockKind(blockEl, item.kind);
  };

  const closeSlashMenu = () => {
    slashOpen = false;
    if (slashMenu) { slashMenu.remove(); slashMenu = null; }
    slashBlock = null;
  };

  let blockMenu = null;
  let blockMenuTarget = null;

  const menuButton = (label, icon, action, danger) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `block-menu-item${danger ? " danger" : ""}`;
    btn.innerHTML = `<span class="bm-ic">${icon}</span> <span class="bm-tx">${label}</span>`;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const target = blockMenuTarget;
      closeBlockMenu();
      if (target) action(target);
    });
    return btn;
  };

  const menuDivider = () => {
    const line = document.createElement("div");
    line.className = "block-menu-divider";
    return line;
  };

  const openBlockMenu = (blockEl, x, y) => {
    closeSlashMenu();
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
      blockMenu.appendChild(menuButton(`Transformar em ${item.label}`, item.icon, (b) => setBlockKind(b, item.kind)));
    });
    blockMenu.appendChild(menuDivider());
    blockMenu.appendChild(menuButton("Apagar bloco", icDel, deleteBlock, true));

    document.body.appendChild(blockMenu);
    placeFloatingPanel(blockMenu, window.scrollX + x, window.scrollY + y, 10);
  };

  const closeBlockMenu = () => {
    if (blockMenu) blockMenu.remove();
    blockMenu = null;
    blockMenuTarget = null;
  };

  const closeFloatingPanels = () => {
    closeSlashMenu();
    closeBlockMenu();
    closeEmojiPicker();
    closeSubjectMenu();
  };

  document.addEventListener("click", (e) => {
    if (slashOpen && slashMenu && !slashMenu.contains(e.target)) closeSlashMenu();
    if (blockMenu && !blockMenu.contains(e.target) && !e.target.closest(".block-add-btn")) closeBlockMenu();
    if (emojiPanel && !emojiPanel.contains(e.target)
        && !e.target.closest("#emoji-insert") && !e.target.closest("#page-icon")) closeEmojiPicker();
    if (subjectMenu && !subjectMenu.contains(e.target)
        && !e.target.closest("#page-subject-chip")) closeSubjectMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFloatingPanels();
  });

  // ---------- Bindings por página (religados pelo initEditor) ----------
  const bindTitle = (pid) => {
    const titleEl = document.getElementById("page-title");
    if (!titleEl) return;
    let titleTimer = null;
    const commitTitle = () => {
      titleTimer = null;
      api(pageUrl(pid), "PATCH", { title: titleEl.textContent.trim() })
        .then((data) => syncTitleCopies(pid, data.title, titleEl))
        .catch(console.error);
    };
    flushTitleSave = () => {
      if (titleTimer) { clearTimeout(titleTimer); commitTitle(); }
    };
    titleEl.addEventListener("input", () => {
      clearTimeout(titleTimer);
      titleTimer = setTimeout(commitTitle, 500);
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const first = blocksEl.querySelector(".block-text");
        if (first) focusEnd(first); else addBlockAtEnd();
      }
    });
  };

  const bindIcon = (pid) => {
    const iconEl = document.getElementById("page-icon");
    if (!iconEl) return;
    iconEl.addEventListener("click", () => {
      openEmojiPicker(iconEl, (emoji) => {
        iconEl.textContent = emoji;
        syncIconCopies(pid, emoji);
        api(pageUrl(pid), "PATCH", { icon: emoji }).catch(console.error);
      });
    });
  };

  // Barra de ações da página: inserir emoji, favoritar, apagar.
  const bindPageActions = (pid) => {
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
        try { await api(pageUrl(pid), "PATCH", { is_favorite: on }); }
        catch (err) { console.error(err); }
      });
    }

    const delBtn = document.getElementById("delete-page");
    if (delBtn && delModal) {
      delBtn.addEventListener("click", () => {
        delModal.removeAttribute("data-target-id"); // fallback: usa a pageId atual
        delModal.style.display = "flex";
      });
    }
  };

  const bindSubjectChip = () => {
    if (!subjectChip) return;
    subjectChip.addEventListener("click", () => {
      if (subjectMenu) closeSubjectMenu();
      else openSubjectPicker(subjectChip);
    });
  };

  // ---------- Inicialização do editor ----------
  // Roda no load e após cada navegação SPA (o conteúdo do pane é trocado).
  const initEditor = () => {
    pageId = pane && pane.dataset.pageId ? pane.dataset.pageId : null;
    blocksEl = document.getElementById("blocks");
    subjectChip = document.getElementById("page-subject-chip");
    currentSubjectId = pane && pane.dataset.subjectId ? Number(pane.dataset.subjectId) : null;
    lastEditable = null;
    lastRange = null;
    flushTitleSave = null;
    if (!pageId || !blocksEl) return;
    const pid = pageId;   // congela o id: PATCH atrasado não vaza p/ outra página

    bindTitle(pid);
    bindIcon(pid);
    bindPageActions(pid);
    bindSubjectChip();

    const addBtn = document.getElementById("add-block");
    if (addBtn) addBtn.addEventListener("click", () => addBlockAtEnd());

    bindBlockDnD();
    bindBlockEvents();
  };

  // ---------- Navegação SPA entre páginas (History API) ----------
  // Troca só o conteúdo do editor; sidebar, timer e gaveta seguem vivos.
  const PAGE_PATH_RE = /^\/workspace\/p\/\d+\/$/;
  let navAbort = null;   // a navegação mais nova cancela a anterior

  const setActiveTreeRow = (pid) => {
    document.querySelectorAll(".sidebar .tree-row.is-active")
      .forEach((row) => row.classList.remove("is-active"));
    if (!pid) return;
    treeRowEls(pid).forEach((row) => row.classList.add("is-active"));
    revealActiveTreeRow();
  };

  // Favoritar muda a sidebar no servidor; reaproveita o HTML já buscado.
  const syncFavoritesSection = (doc) => {
    const SEL = ".sidebar .sidebar-section:not(.sidebar-scroll)";
    const cur = document.querySelector(SEL);
    const fresh = doc.querySelector(SEL);
    if (cur && fresh) cur.replaceWith(fresh);
    else if (fresh) {
      const scroll = document.querySelector(".sidebar .sidebar-scroll");
      if (scroll) scroll.before(fresh);
    } else if (cur) cur.remove();
    applyTreeCollapse();
  };

  const navigateToPage = async (url, push = true) => {
    if (!pane) return;
    if (navAbort) navAbort.abort();
    const ctrl = new AbortController();
    navAbort = ctrl;
    flushPendingSaves();
    pane.classList.add("is-loading");
    pane.setAttribute("aria-busy", "true");
    try {
      const res = await fetch(url, { headers: { Accept: "text/html" }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
      const html = await res.text();
      if (ctrl.signal.aborted) return;
      const doc = new DOMParser().parseFromString(html, "text/html");
      const fresh = doc.getElementById("editor-pane");
      // Sem pane na resposta = não é o workspace (ex.: sessão expirada -> login).
      if (!fresh) throw new Error("editor-pane ausente na resposta");

      closeFloatingPanels();
      pane.replaceChildren(...fresh.childNodes);
      pane.dataset.pageId = fresh.dataset.pageId || "";
      pane.dataset.subjectId = fresh.dataset.subjectId || "";
      document.title = doc.title;
      // res.url cobre redirects do servidor (ex.: pasta -> primeira página).
      if (push) history.pushState({ wsPage: true }, "", res.url || url);
      // Sessões do pomodoro passam a contar para a página aberta.
      const pomo = document.getElementById("pomodoro");
      if (pomo) pomo.dataset.pageId = pane.dataset.pageId;
      syncFavoritesSection(doc);
      setActiveTreeRow(pane.dataset.pageId);
      pane.scrollTop = 0;
      initEditor();
    } catch (err) {
      if (ctrl.signal.aborted) return;   // outra navegação assumiu o lugar
      console.error(err);
      window.location.href = url;   // fallback: navegação completa
    } finally {
      if (navAbort === ctrl) {
        navAbort = null;
        pane.classList.remove("is-loading");
        pane.removeAttribute("aria-busy");
      }
    }
  };

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0
        || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("a[href]");
    if (!link || link.target || link.origin !== window.location.origin) return;
    if (!PAGE_PATH_RE.test(link.pathname) || link.search) return;
    e.preventDefault();
    // Já está nela (sem query: ?readonly etc. ainda navega para limpar o modo).
    if (link.pathname === window.location.pathname && !window.location.search) return;
    navigateToPage(link.pathname);
  });

  window.addEventListener("popstate", () => {
    const { pathname, search } = window.location;
    if (PAGE_PATH_RE.test(pathname) && !search) navigateToPage(window.location.href, false);
    else window.location.reload();
  });

  initEditor();
})();
