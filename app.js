const STORAGE_KEY = "barboseiras_posts_v1";

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

init();

function init() {
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  typeInput.addEventListener("change", toggleKmField);
  form.addEventListener("submit", handleSubmit);

  document.querySelectorAll(".switch").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  buildFilters();
  toggleKmField();
  render();
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

  sorted.forEach((post) => timeline.appendChild(renderPost(post)));
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

  sorted.forEach((post) => library.appendChild(renderPost(post)));
}

function renderPost(post) {
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
  deleteButton.addEventListener("click", () => {
    state.posts = state.posts.filter((item) => item.id !== post.id);
    savePosts();
    render();
  });

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
