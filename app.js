import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* 🔥 CONFIG FIREBASE */
  const firebaseConfig = {
    apiKey: "AIzaSyDW-Om3EpMFVK5H1BfHKkR2IFz5Qpj7IFI",
    authDomain: "diario-40d9e.firebaseapp.com",
    projectId: "diario-40d9e",
    storageBucket: "diario-40d9e.firebasestorage.app",
    messagingSenderId: "39169574766",
    appId: "1:39169574766:web:0ef47ca500c2d8d8dba37f",
    measurementId: "G-SLGTSXX5QN"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

/* 📌 ELEMENTOS */
const loginBtn = document.getElementById("login");
const appEl = document.getElementById("app");
const diary = document.getElementById("diary");
const datePicker = document.getElementById("datePicker");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const pastEl = document.getElementById("past");
const entriesList = document.getElementById("entriesList");
const calendarEl = document.getElementById("calendar");

/* 📆 CONTROLES */
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const calendarLabel = document.getElementById("calendarLabel");
const calendarTitle = document.getElementById("calendarTitle");

/* 🔁 ESTADO */
let currentUser = null;
let currentDate = null;
let calendarMonth = null;
let calendarYear = null;
let calendarVisible = true;

/* 🔐 LOGIN */
loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  currentUser = result.user;

  const today = new Date();
  calendarMonth = today.getMonth();
  calendarYear = today.getFullYear();

  loginBtn.hidden = true;
  appEl.hidden = false;

  setupDatePicker();
  loadAllEntries();
  renderCalendar();
};

/* 📅 DATE PICKER */
function setupDatePicker() {
  const today = new Date().toISOString().split("T")[0];
  datePicker.max = today;
  datePicker.value = today;

  loadEntryForDate(today);

  datePicker.onchange = () => {
    loadEntryForDate(datePicker.value);
  };
}

/* 📖 CARREGAR ENTRADA */
async function loadEntryForDate(dateStr) {
  currentDate = dateStr;
  diary.value = "";
  statusEl.textContent = "";
  pastEl.innerHTML = "";

  const [year, month, day] = dateStr.split("-").map(Number);
  const id = `${currentUser.uid}_${dateStr}`;

  const ref = doc(db, "entries", id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    diary.value = snap.data().text || "";
  }

  loadPastMemories(day, month, year);
}

/* 💾 SALVAR */
saveBtn.onclick = async () => {
  if (!currentDate) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Salvando...";
  statusEl.textContent = "";

  const [year, month, day] = currentDate.split("-").map(Number);
  const ref = doc(db, "entries", `${currentUser.uid}_${currentDate}`);

  try {
    await setDoc(ref, {
      userId: currentUser.uid,
      date: currentDate,
      day,
      month,
      year,
      text: diary.value,
      updatedAt: serverTimestamp()
    });

    statusEl.textContent = "✅ Diário salvo com sucesso!";
    loadAllEntries();
    renderCalendar();
  } catch {
    statusEl.textContent = "❌ Erro ao salvar.";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Salvar diário";
  }
};

/* ⏪ MEMÓRIAS DO MESMO DIA */
async function loadPastMemories(day, month, year) {
  const q = query(
    collection(db, "entries"),
    where("userId", "==", currentUser.uid),
    where("day", "==", day),
    where("month", "==", month),
    where("year", "<", year),
    orderBy("year", "desc")
  );

  const snap = await getDocs(q);

  snap.forEach(d => {
    const e = d.data();
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<strong>${e.day}/${e.month}/${e.year}</strong><p>${e.text || ""}</p>`;
    pastEl.appendChild(div);
  });
}

/* 📚 TODAS MEMÓRIAS */
async function loadAllEntries() {
  entriesList.innerHTML = "Carregando...";

  const q = query(
    collection(db, "entries"),
    where("userId", "==", currentUser.uid),
    orderBy("date", "desc")
  );

  const snap = await getDocs(q);
  entriesList.innerHTML = "";

  if (!snap.size) {
    entriesList.innerHTML = "<p>Nenhuma memória salva.</p>";
    return;
  }

  snap.forEach(d => {
    const e = d.data();
    const div = document.createElement("div");
    div.className = "card";
    div.style.cursor = "pointer";
    div.innerHTML = `<strong>${e.date.split("-").reverse().join("/")}</strong>`;
    div.onclick = () => {
      datePicker.value = e.date;
      loadEntryForDate(e.date);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    entriesList.appendChild(div);
  });
}

/* 📆 CALENDÁRIO */
async function renderCalendar() {
  calendarEl.innerHTML = "";

  const today = new Date();
  const year = calendarYear;
  const month = calendarMonth;

  updateCalendarLabel();

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  let filledDates = new Set();

  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = `${year}-${Str
