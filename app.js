const STORAGE_KEYS = {
  posts: "review_posts_v2",
  settings: "integration_settings_v2"
};

const state = {
  posts: loadJson(STORAGE_KEYS.posts, []),
  imports: [],
  settings: loadJson(STORAGE_KEYS.settings, {
    goodreadsUserId: "",
    goodreadsApiKey: "",
    letterboxdUser: "",
    stravaToken: "",
    lastfmUser: "",
    lastfmApiKey: ""
  })
};

const reviewForm = document.getElementById("reviewForm");
const postsEl = document.getElementById("posts");
const importsEl = document.getElementById("imports");
const syncStatus = document.getElementById("syncStatus");
const postTemplate = document.getElementById("postTemplate");

const fields = {
  category: document.getElementById("category"),
  title: document.getElementById("title"),
  date: document.getElementById("date"),
  rating: document.getElementById("rating"),
  review: document.getElementById("review"),
  referenceUrl: document.getElementById("referenceUrl"),
  goodreadsUserId: document.getElementById("goodreadsUserId"),
  goodreadsApiKey: document.getElementById("goodreadsApiKey"),
  letterboxdUser: document.getElementById("letterboxdUser"),
  stravaToken: document.getElementById("stravaToken"),
  lastfmUser: document.getElementById("lastfmUser"),
  lastfmApiKey: document.getElementById("lastfmApiKey")
};

hydrateSettingsForm();
setDefaultDate();
renderPosts();
renderImports();

reviewForm.addEventListener("submit", handleNewPost);
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runSync(button.dataset.action));
});

Object.entries(fields)
  .filter(([key]) => key.includes("goodreads") || key.includes("letterboxd") || key.includes("strava") || key.includes("lastfm"))
  .forEach(([key, input]) => {
    input.addEventListener("change", () => {
      state.settings[key] = input.value.trim();
      saveJson(STORAGE_KEYS.settings, state.settings);
    });
  });

async function runSync(action) {
  syncStatus.textContent = "Sincronizando...";

  try {
    if (action === "sync-goodreads") {
      state.imports = await syncGoodreads();
    }

    if (action === "sync-letterboxd") {
      state.imports = await syncLetterboxd();
    }

    if (action === "sync-strava") {
      state.imports = await syncStrava();
    }

    if (action === "sync-lastfm") {
      state.imports = await syncLastfm();
    }

    renderImports();
    syncStatus.textContent = `Importação concluída: ${state.imports.length} itens.`;
  } catch (error) {
    console.error(error);
    syncStatus.textContent = `Falha ao sincronizar: ${error.message}`;
  }
}

async function syncGoodreads() {
  const userId = state.settings.goodreadsUserId;
  if (!userId) throw new Error("Preencha o ID do Goodreads.");

  const apiKeyPart = state.settings.goodreadsApiKey ? `?key=${encodeURIComponent(state.settings.goodreadsApiKey)}` : "";
  const url = `https://www.goodreads.com/review/list_rss/${encodeURIComponent(userId)}${apiKeyPart}`;
  const xmlText = await fetchWithCorsFallback(url);
  const feed = new DOMParser().parseFromString(xmlText, "application/xml");
  const items = [...feed.querySelectorAll("item")].slice(0, 12);

  return items.map((item) => ({
    source: "goodreads",
    category: "book",
    title: text(item, "title") || "Livro",
    date: normalizeDate(text(item, "pubDate")),
    review: text(item, "description") || "",
    referenceUrl: text(item, "link") || ""
  }));
}

async function syncLetterboxd() {
  const user = state.settings.letterboxdUser;
  if (!user) throw new Error("Preencha o username do Letterboxd.");

  const url = `https://letterboxd.com/${encodeURIComponent(user)}/rss/`;
  const xmlText = await fetchWithCorsFallback(url);
  const feed = new DOMParser().parseFromString(xmlText, "application/xml");
  const items = [...feed.querySelectorAll("item")].slice(0, 12);

  return items.map((item) => ({
    source: "letterboxd",
    category: "movie",
    title: (text(item, "title") || "Filme").replace(`${user} watched `, ""),
    date: normalizeDate(text(item, "pubDate")),
    review: text(item, "description") || "",
    referenceUrl: text(item, "link") || ""
  }));
}

async function syncStrava() {
  const token = state.settings.stravaToken;
  if (!token) throw new Error("Preencha o token do Strava.");

  const response = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=12", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Token inválido ou sem escopo de leitura no Strava.");
  }

  const activities = await response.json();
  return activities.map((activity) => ({
    source: "strava",
    category: "run",
    title: activity.name || "Corrida",
    date: normalizeDate(activity.start_date_local),
    review: `${(activity.distance / 1000).toFixed(2)} km em ${(activity.moving_time / 60).toFixed(0)} min.`,
    referenceUrl: `https://www.strava.com/activities/${activity.id}`
  }));
}

async function syncLastfm() {
  const user = state.settings.lastfmUser;
  const apiKey = state.settings.lastfmApiKey;
  if (!user || !apiKey) throw new Error("Preencha usuário e API key do Last.fm.");

  const query = new URLSearchParams({
    method: "user.getrecenttracks",
    user,
    api_key: apiKey,
    format: "json",
    limit: "12"
  });

  const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Erro ao conectar no Last.fm.");
  }

  const data = await response.json();
  const tracks = data?.recenttracks?.track ?? [];

  return tracks.map((track) => ({
    source: "lastfm",
    category: "music",
    title: `${track.artist["#text"]} — ${track.name}`,
    date: normalizeDate(track.date?.["#text"] || new Date().toISOString()),
    review: track.album?.["#text"] ? `Álbum: ${track.album["#text"]}` : "Faixa ouvida.",
    referenceUrl: track.url || ""
  }));
}

function handleNewPost(event) {
  event.preventDefault();

  const post = {
    id: crypto.randomUUID(),
    category: fields.category.value,
    title: fields.title.value.trim(),
    date: fields.date.value,
    rating: fields.rating.value ? Number(fields.rating.value) : null,
    review: fields.review.value.trim(),
    referenceUrl: fields.referenceUrl.value.trim()
  };

  state.posts.unshift(post);
  saveJson(STORAGE_KEYS.posts, state.posts);
  reviewForm.reset();
  setDefaultDate();
  renderPosts();
}

function renderPosts() {
  postsEl.innerHTML = "";

  if (!state.posts.length) {
    postsEl.innerHTML = "<p>Nenhum review ainda.</p>";
    return;
  }

  const sorted = [...state.posts].sort((a, b) => (a.date < b.date ? 1 : -1));
  sorted.forEach((post) => postsEl.appendChild(buildPostCard(post, true)));
}

function renderImports() {
  importsEl.innerHTML = "";

  if (!state.imports.length) {
    importsEl.innerHTML = "<p>Nenhum item importado nesta sessão.</p>";
    return;
  }

  state.imports.forEach((item) => {
    const card = buildPostCard(item, false);
    const importButton = document.createElement("button");
    importButton.textContent = "Criar review desse item";
    importButton.addEventListener("click", () => fillFormFromImport(item));
    card.appendChild(importButton);
    importsEl.appendChild(card);
  });
}

function buildPostCard(item, allowDelete) {
  const fragment = postTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".post");
  root.querySelector(".tag").textContent = labelFromCategory(item.category, item.source);
  root.querySelector("time").textContent = formatDate(item.date);
  root.querySelector("h3").textContent = item.title || "Sem título";
  root.querySelector(".rating").textContent = item.rating !== null && item.rating !== undefined ? `Nota: ${item.rating}/10` : "";
  root.querySelector(".body").textContent = stripHtml(item.review || "");

  const refLink = root.querySelector(".ref");
  if (item.referenceUrl) {
    refLink.href = item.referenceUrl;
    refLink.textContent = "Abrir referência";
  } else {
    refLink.remove();
  }

  const deleteButton = root.querySelector(".delete-btn");
  if (!allowDelete) {
    deleteButton.remove();
  } else {
    deleteButton.addEventListener("click", () => {
      state.posts = state.posts.filter((post) => post.id !== item.id);
      saveJson(STORAGE_KEYS.posts, state.posts);
      renderPosts();
    });
  }

  return fragment;
}

function fillFormFromImport(item) {
  fields.category.value = item.category || "custom";
  fields.title.value = item.title || "";
  fields.date.value = item.date || new Date().toISOString().slice(0, 10);
  fields.review.value = stripHtml(item.review || "");
  fields.referenceUrl.value = item.referenceUrl || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hydrateSettingsForm() {
  for (const [key, value] of Object.entries(state.settings)) {
    if (fields[key]) {
      fields[key].value = value;
    }
  }
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setDefaultDate() {
  fields.date.value = new Date().toISOString().slice(0, 10);
}

function normalizeDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Sem data";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}

function labelFromCategory(category, source) {
  const labels = {
    book: "Livro",
    movie: "Filme",
    run: "Corrida",
    music: "Música",
    custom: "Livre"
  };

  const base = labels[category] ?? "Post";
  return source ? `${base} • ${source}` : base;
}

function text(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() ?? "";
}

function stripHtml(value) {
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent?.trim() ?? "";
}

async function fetchWithCorsFallback(url) {
  const directResponse = await fetch(url);
  if (directResponse.ok) {
    return directResponse.text();
  }

  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const proxyResponse = await fetch(proxy);
  if (!proxyResponse.ok) {
    throw new Error("Não foi possível ler o feed remoto.");
  }

  return proxyResponse.text();
}
