const APP_VERSION = 2;
const STORAGE_KEY = "barboseiras_data_v2";
const LEGACY_STORAGE_KEYS = ["barboseiras_posts_v1", "review_posts_v2", "diario_posts", "posts"];
const LETTERBOXD_USER_KEY = "barboseiras_letterboxd_user";
const PAGE_SIZE = 8;

const TYPE_LABEL = {
  filme: "Filme",
  serie: "Série de TV",
  livro: "Livro",
  quadrinhos: "Quadrinhos",
  videogame: "Video Games",
  corrida: "Corridas",
  musica: "Músicas",
  album: "Álbuns",
  livre: "Post livre"
};

const state = {
  posts: [],
  imports: [],
  currentView: "timeline",
  currentFilter: "all",
  search: "",
  sort: "newest",
  page: 1,
  editingId: null
};

const el = {
  form: document.getElementById("postForm"),
  composerTitle: document.getElementById("composerTitle"),
  submitBtn: document.getElementById("submitBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  typeInput: document.getElementById("type"),
  kmField: document.getElementById("kmField"),
  timeline: document.getElementById("timeline"),
  library: document.getElementById("library"),
  filters: document.getElementById("filters"),
  template: document.getElementById("postTemplate"),
  timelineView: document.getElementById("timelineView"),
  libraryView: document.getElementById("libraryView"),
  importsEl: document.getElementById("imports"),
  syncBtn: document.getElementById("syncLetterboxdBtn"),
  syncStatus: document.getElementById("syncStatus"),
  postStatus: document.getElementById("postStatus"),
  toast: document.getElementById("toast"),
  letterboxdInput: document.getElementById("letterboxdUser"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageLabel: document.getElementById("pageLabel"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile")
};

init();

function init() {
  state.posts = loadPosts();

  document.getElementById("date").value = todayIso();
  el.letterboxdInput.value = localStorage.getItem(LETTERBOXD_USER_KEY) || "";

  el.typeInput.addEventListener("change", toggleKmField);
  el.form.addEventListener("submit", handleSubmit);
  el.cancelEditBtn.addEventListener("click", resetComposer);
  el.syncBtn.addEventListener("click", syncLetterboxd);
  el.searchInput.addEventListener("input", () => { state.search = el.searchInput.value.trim().toLowerCase(); state.page = 1; render(); });
  el.sortSelect.addEventListener("change", () => { state.sort = el.sortSelect.value; state.page = 1; render(); });
  el.prevPageBtn.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; render(); } });
  el.nextPageBtn.addEventListener("click", () => { state.page += 1; render(); });
  el.exportBtn.addEventListener("click", exportBackup);
  el.importFile.addEventListener("change", importBackup);

  document.querySelectorAll(".switch").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  buildFilters();
  toggleKmField();
  render();
  renderImports();
}

function getFormData() {
  const data = {
    id: state.editingId || crypto.randomUUID(),
    type: document.getElementById("type").value,
    title: document.getElementById("title").value.trim(),
    date: document.getElementById("date").value,
    rating: nullableNumber(document.getElementById("rating").value),
    km: nullableNumber(document.getElementById("km").value),
    content: document.getElementById("content").value.trim(),
    updatedAt: Date.now()
  };

  if (!data.title || data.title.length < 2) throw new Error("Título precisa ter pelo menos 2 caracteres.");
  if (!data.date) throw new Error("Data é obrigatória.");
  if (data.rating !== null && (data.rating < 0 || data.rating > 10)) throw new Error("Nota deve ficar entre 0 e 10.");
  if (data.type === "corrida" && data.km !== null && data.km < 0) throw new Error("Quilometragem inválida.");

  return data;
}

function handleSubmit(event) {
  event.preventDefault();

  try {
    const post = getFormData();

    if (state.editingId) {
      state.posts = state.posts.map((item) => (item.id === state.editingId ? post : item));
      setFeedback(el.postStatus, "Post atualizado com sucesso.", "success");
      flashToast("Post atualizado com sucesso.", "success");
    } else {
      state.posts.unshift(post);
      setFeedback(el.postStatus, "Post publicado com sucesso.", "success");
      flashToast("Post publicado com sucesso.", "success");
    }

    savePosts();
    resetComposer();
    render();
  } catch (error) {
    setFeedback(el.postStatus, error.message, "error");
    flashToast(error.message, "error");
  }
}

function beginEdit(post) {
  state.editingId = post.id;
  document.getElementById("type").value = post.type;
  document.getElementById("title").value = post.title;
  document.getElementById("date").value = post.date;
  document.getElementById("rating").value = post.rating ?? "";
  document.getElementById("km").value = post.km ?? "";
  document.getElementById("content").value = post.content || "";

  el.composerTitle.textContent = "Editar post";
  el.submitBtn.textContent = "Salvar edição";
  el.cancelEditBtn.classList.remove("hidden");
  toggleKmField();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetComposer() {
  state.editingId = null;
  el.form.reset();
  document.getElementById("date").value = todayIso();
  el.composerTitle.textContent = "Novo post";
  el.submitBtn.textContent = "Publicar";
  el.cancelEditBtn.classList.add("hidden");
  toggleKmField();
}

function duplicatePost(post) {
  const copy = { ...post, id: crypto.randomUUID(), updatedAt: Date.now(), title: `${post.title} (cópia)` };
  state.posts.unshift(copy);
  savePosts();
  render();
  setFeedback(el.postStatus, "Post duplicado.", "success");
  flashToast("Post duplicado.", "success");
}

function deletePost(postId) {
  state.posts = state.posts.filter((item) => item.id !== postId);
  savePosts();
  render();
  setFeedback(el.postStatus, "Post excluído.", "success");
  flashToast("Post excluído.", "success");
}

function setView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll(".switch").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  el.timelineView.classList.toggle("hidden", viewName !== "timeline");
  el.libraryView.classList.toggle("hidden", viewName !== "library");
  state.page = 1;
  render();
}

function buildFilters() {
  const entries = [{ key: "all", label: "Todos" }].concat(
    Object.entries(TYPE_LABEL).map(([key, label]) => ({ key, label }))
  );

  el.filters.innerHTML = "";
  entries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.textContent = entry.label;
    btn.classList.toggle("active", entry.key === state.currentFilter);
    btn.addEventListener("click", () => {
      state.currentFilter = entry.key;
      state.page = 1;
      buildFilters();
      render();
    });
    el.filters.appendChild(btn);
  });
}

function getVisiblePosts() {
  const base = state.currentView === "library" && state.currentFilter !== "all"
    ? state.posts.filter((post) => post.type === state.currentFilter)
    : state.posts;

  const searched = base.filter((post) => {
    if (!state.search) return true;
    const text = `${post.title} ${post.content}`.toLowerCase();
    return text.includes(state.search);
  });

  const sorted = [...searched].sort((a, b) => {
    if (state.sort === "oldest") return a.date > b.date ? 1 : -1;
    if (state.sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
    if (state.sort === "title") return (a.title || "").localeCompare(b.title || "", "pt-BR");
    return a.date < b.date ? 1 : -1;
  });

  return sorted;
}

function paginate(posts) {
  const maxPage = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  if (state.page > maxPage) state.page = maxPage;

  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = posts.slice(start, start + PAGE_SIZE);

  el.pageLabel.textContent = `Página ${state.page} de ${maxPage}`;
  el.prevPageBtn.disabled = state.page === 1;
  el.nextPageBtn.disabled = state.page === maxPage;

  return pageItems;
}

function render() {
  const visible = getVisiblePosts();
  const pageItems = paginate(visible);

  const target = state.currentView === "timeline" ? el.timeline : el.library;
  target.innerHTML = "";

  if (!pageItems.length) {
    target.innerHTML = state.search
      ? "<p>Nenhum resultado para essa busca.</p>"
      : "<p>Nenhum post ainda. Crie seu primeiro post acima.</p>";
    return;
  }

  pageItems.forEach((post) => target.appendChild(renderPost(post)));

  if (state.currentView === "timeline") {
    el.library.innerHTML = "";
  } else {
    el.timeline.innerHTML = "";
  }
}

function renderPost(post, readonly = false) {
  const clone = el.template.content.cloneNode(true);
  const root = clone.querySelector(".post-item");

  root.querySelector(".pill").textContent = TYPE_LABEL[post.type] || "Post";
  root.querySelector("time").textContent = toPtBr(post.date);
  root.querySelector(".title").textContent = post.title || "Sem título";
  root.querySelector(".body").textContent = post.content || "";

  const extras = [];
  if (post.rating !== null && post.rating !== undefined) extras.push(`Nota: ${post.rating}/10`);
  if (post.type === "corrida" && post.km !== null && post.km !== undefined) extras.push(`Distância: ${post.km.toFixed(2)} km`);
  root.querySelector(".extra").textContent = extras.join(" • ");

  if (readonly) {
    root.querySelector(".row-actions").remove();
  } else {
    root.querySelector(".edit-btn").addEventListener("click", () => beginEdit(post));
    root.querySelector(".duplicate-btn").addEventListener("click", () => duplicatePost(post));
    root.querySelector(".delete-btn").addEventListener("click", () => deletePost(post.id));
  }

  return clone;
}

function renderImports() {
  el.importsEl.innerHTML = "";

  if (!state.imports.length) {
    el.importsEl.innerHTML = "<p>Nenhum item importado ainda.</p>";
    return;
  }

  state.imports.forEach((item) => {
    const card = renderPost(item, true);
    const action = document.createElement("button");
    action.className = "secondary";

    const exists = state.posts.some((post) => fingerprint(post) === fingerprint(item));
    action.textContent = exists ? "Já está na timeline" : "Adicionar na timeline";
    action.disabled = exists;

    action.addEventListener("click", () => {
      const alreadyExists = state.posts.some((post) => fingerprint(post) === fingerprint(item));
      if (alreadyExists) {
        flashToast("Esse item já existe na timeline.", "error");
        return;
      }

      state.posts.unshift({ ...item, id: crypto.randomUUID(), updatedAt: Date.now() });
      savePosts();
      render();
      renderImports();
      setFeedback(el.postStatus, "Item importado adicionado à timeline.", "success");
      flashToast("Item importado adicionado à timeline.", "success");
    });

    card.querySelector(".post-item").appendChild(action);
    el.importsEl.appendChild(card);
  });
}

async function syncLetterboxd() {
  const user = el.letterboxdInput.value.trim();

  if (!user) {
    setFeedback(el.syncStatus, "Informe o username do Letterboxd.", "error");
    flashToast("Informe o username do Letterboxd.", "error");
    return;
  }

  localStorage.setItem(LETTERBOXD_USER_KEY, user);
  setFeedback(el.syncStatus, "Sincronizando...", "info");
  el.syncBtn.disabled = true;

  try {
    const items = await fetchLetterboxdFeed(user);
    state.imports = items;
    renderImports();
    const message = `Sincronizado com sucesso: ${items.length} itens importados.`;
    setFeedback(el.syncStatus, message, "success");
    flashToast(message, "success");
  } catch (error) {
    const message = `Falha ao sincronizar: ${error.message}`;
    setFeedback(el.syncStatus, message, "error");
    flashToast(message, "error");
  } finally {
    el.syncBtn.disabled = false;
  }
}

async function fetchLetterboxdFeed(user) {
  const rssUrl = `https://letterboxd.com/${encodeURIComponent(user)}/rss/`;

  const strategies = [
    ["RSS direto", async () => parseLetterboxdXml(await fetchText(rssUrl), user)],
    ["AllOrigins", async () => parseLetterboxdXml(await fetchViaAllOrigins(rssUrl), user)],
    ["Isomorphic", async () => parseLetterboxdXml(await fetchText(`https://cors.isomorphic-git.org/${rssUrl}`), user)],
    ["r.jina.ai", async () => parseLetterboxdXml(await fetchText(`https://r.jina.ai/http://letterboxd.com/${encodeURIComponent(user)}/rss/`), user)],
    ["rss2json", async () => parseLetterboxdJson(await fetchJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`), user)]
  ];

  let lastError = new Error("Não foi possível carregar o feed do Letterboxd.");

  for (let i = 0; i < strategies.length; i += 1) {
    const [name, attempt] = strategies[i];
    setFeedback(el.syncStatus, `Tentativa ${i + 1}/${strategies.length}: ${name}...`, "info");

    try {
      const items = await attempt();
      if (items.length) return items;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError.message || "Falha ao importar o feed.");
}

function parseLetterboxdXml(xmlText, user) {
  const feed = new DOMParser().parseFromString(xmlText, "application/xml");
  const nodes = [...feed.querySelectorAll("item")].slice(0, 24);

  return nodes.map((item) => ({
    id: crypto.randomUUID(),
    type: "filme",
    title: (readText(item, "title") || "Filme").replace(`${user} watched `, "").replace(`${user} reviewed `, ""),
    date: normalizeDate(readText(item, "pubDate")),
    rating: null,
    km: null,
    content: stripHtml(readText(item, "description")),
    updatedAt: Date.now()
  }));
}

function parseLetterboxdJson(payload, user) {
  const items = payload?.items ?? [];

  return items.slice(0, 24).map((item) => ({
    id: crypto.randomUUID(),
    type: "filme",
    title: (item.title || "Filme").replace(`${user} watched `, "").replace(`${user} reviewed `, ""),
    date: normalizeDate(item.pubDate),
    rating: null,
    km: null,
    content: stripHtml(item.description || ""),
    updatedAt: Date.now()
  }));
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
  return response.json();
}

async function fetchViaAllOrigins(url) {
  const payload = await fetchJson(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  const contents = payload?.contents || "";
  if (!contents) throw new Error("Proxy retornou resposta vazia.");
  return contents;
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.posts)) return dedupePosts(parsed.posts);
      if (Array.isArray(parsed)) return dedupePosts(parsed);
    }
  } catch {
    // segue para migração
  }

  const collected = [];
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) collected.push(...parsed);
    } catch {
      // ignora
    }
  }

  const migrated = dedupePosts(collected);
  if (migrated.length) saveDataEnvelope(migrated);
  return migrated;
}

function dedupePosts(posts) {
  const seen = new Set();
  const normalized = [];

  for (const post of posts) {
    if (!post) continue;
    const normalizedPost = {
      id: post.id || crypto.randomUUID(),
      type: post.type || "livre",
      title: post.title || "Sem título",
      date: post.date || todayIso(),
      rating: post.rating ?? null,
      km: post.km ?? null,
      content: post.content || post.review || post.text || "",
      updatedAt: post.updatedAt || Date.now()
    };

    const key = fingerprint(normalizedPost);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(normalizedPost);
  }

  return normalized;
}

function savePosts() {
  saveDataEnvelope(state.posts);
}

function saveDataEnvelope(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: APP_VERSION,
    updatedAt: Date.now(),
    posts
  }));
}

function exportBackup() {
  const payload = {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    posts: state.posts
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `barboseiras-backup-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  flashToast("Backup exportado com sucesso.", "success");
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const importedPosts = Array.isArray(data?.posts) ? data.posts : Array.isArray(data) ? data : [];

    state.posts = dedupePosts([...importedPosts, ...state.posts]);
    savePosts();
    state.page = 1;
    render();
    flashToast("Backup importado com sucesso.", "success");
  } catch {
    flashToast("Arquivo de backup inválido.", "error");
  } finally {
    el.importFile.value = "";
  }
}

function setFeedback(element, message, tone = "info") {
  element.textContent = message;
  element.classList.remove("success", "error");
  if (tone === "success") element.classList.add("success");
  if (tone === "error") element.classList.add("error");
}

let toastTimer;
function flashToast(message, tone = "success") {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden", "error");
  if (tone === "error") el.toast.classList.add("error");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2600);
}

function toggleKmField() {
  el.kmField.classList.toggle("hidden", el.typeInput.value !== "corrida");
}

function nullableNumber(value) {
  if (value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function fingerprint(post) {
  return `${post.type}-${post.date}-${(post.title || "").trim().toLowerCase()}`;
}

function toPtBr(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString("pt-BR");
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? todayIso() : date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readText(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

function stripHtml(raw) {
  const div = document.createElement("div");
  div.innerHTML = raw;
  return div.textContent?.trim() || "";
}
