const STORAGE_KEY = "barboseiras_posts_v1";
const LETTERBOXD_USER_KEY = "barboseiras_letterboxd_user";

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
  posts: loadPosts(),
  imports: [],
  currentView: "timeline",
  currentFilter: "all"
};

const form = document.getElementById("postForm");
const typeInput = document.getElementById("type");
const kmField = document.getElementById("kmField");
const timeline = document.getElementById("timeline");
const library = document.getElementById("library");
const filters = document.getElementById("filters");
const template = document.getElementById("postTemplate");
const timelineView = document.getElementById("timelineView");
const libraryView = document.getElementById("libraryView");
const importsEl = document.getElementById("imports");
const syncBtn = document.getElementById("syncLetterboxdBtn");
const syncStatus = document.getElementById("syncStatus");
const letterboxdInput = document.getElementById("letterboxdUser");

init();

function init() {
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  letterboxdInput.value = localStorage.getItem(LETTERBOXD_USER_KEY) || "";

  typeInput.addEventListener("change", toggleKmField);
  form.addEventListener("submit", handleSubmit);
  syncBtn.addEventListener("click", syncLetterboxd);

  document.querySelectorAll(".switch").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  buildFilters();
  toggleKmField();
  render();
  renderImports();
}

async function syncLetterboxd() {
  const user = letterboxdInput.value.trim();

  if (!user) {
    syncStatus.textContent = "Informe o username do Letterboxd.";
    return;
  }

  localStorage.setItem(LETTERBOXD_USER_KEY, user);
  syncStatus.textContent = "Sincronizando...";
  syncBtn.disabled = true;

  try {
    const items = await fetchLetterboxdFeed(user);
    state.imports = items;
    renderImports();
    syncStatus.textContent = `Sincronizado com sucesso: ${items.length} itens importados.`;
  } catch (error) {
    console.error(error);
    syncStatus.textContent = `Falha ao sincronizar: ${error.message}`;
  } finally {
    syncBtn.disabled = false;
  }
}

async function fetchLetterboxdFeed(user) {
  const rssUrl = `https://letterboxd.com/${encodeURIComponent(user)}/rss/`;

  const strategies = [
    async () => parseLetterboxdXml(await fetchText(rssUrl), user),
    async () => parseLetterboxdXml(await fetchText(`https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`), user),
    async () => parseLetterboxdJson(await fetchJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`), user)
  ];

  let lastError = new Error("Não foi possível carregar o feed do Letterboxd.");

  for (const attempt of strategies) {
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
  const nodes = [...feed.querySelectorAll("item")].slice(0, 12);

  return nodes.map((item) => ({
    id: crypto.randomUUID(),
    type: "filme",
    title: (readText(item, "title") || "Filme").replace(`${user} watched `, "").replace(`${user} reviewed `, ""),
    date: normalizeDate(readText(item, "pubDate")),
    rating: null,
    km: null,
    content: stripHtml(readText(item, "description"))
  }));
}

function parseLetterboxdJson(payload, user) {
  const items = payload?.items ?? [];

  return items.slice(0, 12).map((item) => ({
    id: crypto.randomUUID(),
    type: "filme",
    title: (item.title || "Filme").replace(`${user} watched `, "").replace(`${user} reviewed `, ""),
    date: normalizeDate(item.pubDate),
    rating: null,
    km: null,
    content: stripHtml(item.description || "")
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

function renderImports() {
  importsEl.innerHTML = "";

  if (!state.imports.length) {
    importsEl.innerHTML = "<p>Nenhum item importado ainda.</p>";
    return;
  }

  state.imports.forEach((item) => {
    const card = renderPost(item, false);
    const action = document.createElement("button");
    action.className = "import-action";
    action.textContent = "Adicionar na timeline";
    action.addEventListener("click", () => {
      state.posts.unshift({ ...item, id: crypto.randomUUID() });
      savePosts();
      render();
    });

    card.querySelector(".post-item").appendChild(action);
    importsEl.appendChild(card);
  });
}

function handleSubmit(event) {
  event.preventDefault();

  const post = {
    id: crypto.randomUUID(),
    type: document.getElementById("type").value,
    title: document.getElementById("title").value.trim(),
    date: document.getElementById("date").value,
    rating: nullableNumber(document.getElementById("rating").value),
    km: nullableNumber(document.getElementById("km").value),
    content: document.getElementById("content").value.trim()
  };

  state.posts.unshift(post);
  savePosts();

  form.reset();
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  toggleKmField();
  render();
}

function setView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll(".switch").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  timelineView.classList.toggle("hidden", viewName !== "timeline");
  libraryView.classList.toggle("hidden", viewName !== "library");
}

function buildFilters() {
  const entries = [{ key: "all", label: "Todos" }].concat(
    Object.entries(TYPE_LABEL).map(([key, label]) => ({ key, label }))
  );

  filters.innerHTML = "";
  entries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.textContent = entry.label;
    btn.classList.toggle("active", entry.key === state.currentFilter);
    btn.addEventListener("click", () => {
      state.currentFilter = entry.key;
      buildFilters();
      renderLibrary();
    });
    filters.appendChild(btn);
  });
}

function render() {
  renderTimeline();
  renderLibrary();
}

function renderTimeline() {
  timeline.innerHTML = "";
  const sorted = [...state.posts].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!sorted.length) {
    timeline.innerHTML = "<p>Nenhum post ainda.</p>";
    return;
  }

  sorted.forEach((post) => timeline.appendChild(renderPost(post, true)));
}

function renderLibrary() {
  library.innerHTML = "";

  const filtered = state.currentFilter === "all"
    ? state.posts
    : state.posts.filter((post) => post.type === state.currentFilter);

  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!sorted.length) {
    library.innerHTML = "<p>Nenhum item nesse tipo.</p>";
    return;
  }

  sorted.forEach((post) => library.appendChild(renderPost(post, true)));
}

function renderPost(post, showDelete) {
  const clone = template.content.cloneNode(true);
  const root = clone.querySelector(".post-item");

  root.querySelector(".pill").textContent = TYPE_LABEL[post.type] || "Post";
  root.querySelector("time").textContent = toPtBr(post.date);
  root.querySelector(".title").textContent = post.title || "Sem título";
  root.querySelector(".body").textContent = post.content || "";

  const extras = [];
  if (post.rating !== null && post.rating !== undefined) extras.push(`Nota: ${post.rating}/10`);
  if (post.type === "corrida" && post.km !== null && post.km !== undefined) extras.push(`Distância: ${post.km.toFixed(2)} km`);
  root.querySelector(".extra").textContent = extras.join(" • ");

  const deleteButton = root.querySelector(".danger");
  if (!showDelete) {
    deleteButton.remove();
  } else {
    deleteButton.addEventListener("click", () => {
      state.posts = state.posts.filter((item) => item.id !== post.id);
      savePosts();
      render();
    });
  }

  return clone;
}

function toggleKmField() {
  const isRunning = typeInput.value === "corrida";
  kmField.classList.toggle("hidden", !isRunning);
}

function nullableNumber(value) {
  if (value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toPtBr(dateStr) {
  if (!dateStr) return "Sem data";
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("pt-BR");
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function readText(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

function stripHtml(raw) {
  const div = document.createElement("div");
  div.innerHTML = raw;
  return div.textContent?.trim() || "";
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePosts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.posts));
}
