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

/* 🔥 CONFIG FIREBASE (USE A SUA REAL) */
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

/* 🔁 ESTADO */
let currentUser = null;
let currentDate = null;

/* 🔐 LOGIN */
loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  currentUser = result.user;

  loginBtn.hidden = true;
  appEl.hidden = false;

  setupDatePicker();
  loadAllEntries();
  renderCalendar();
};

/* 📅 CONFIGURA DATE PICKER */
function setupDatePicker() {
  const today = new Date().toISOString().split("T")[0];
  datePicker.max = today;
  datePicker.value = today;

  loadEntryForDate(today);

  datePicker.onchange = () => {
    loadEntryForDate(datePicker.value);
  };
}

/* 📖 CARREGA ENTRADA */
async function loadEntryForDate(dateStr) {
  currentDate = dateStr;
  diary.value = "";
  statusEl.textContent = "";
  pastEl.innerHTML = "";

  const [year, month, day] = dateStr.split("-").map(Number);
  const id = `${currentUser.uid}_${dateStr}`;

  try {
    const ref = doc(db, "entries", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      diary.value = snap.data().text || "";
    }

    loadPastMemories(day, month, year);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "⚠️ Erro ao carregar a data.";
  }
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
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ Erro ao salvar o diário.";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Salvar diário";
  }
};

/* ⏪ MEMÓRIAS DO MESMO DIA EM OUTROS ANOS */
async function loadPastMemories(day, month, year) {
  try {
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
      div.innerHTML = `
        <strong>${e.day}/${e.month}/${e.year}</strong>
        <p>${e.text || ""}</p>
      `;
      pastEl.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

/* 📚 LISTA DE MEMÓRIAS */
async function loadAllEntries() {
  entriesList.innerHTML = "Carregando...";

  try {
    const q = query(
      collection(db, "entries"),
      where("userId", "==", currentUser.uid),
      orderBy("date", "desc")
    );

    const snap = await getDocs(q);
    entriesList.innerHTML = "";

    if (!snap.size) {
      entriesList.innerHTML = "<p>Nenhuma memória salva ainda.</p>";
      return;
    }

    snap.forEach(d => {
      const e = d.data();
      if (!e.date) return;

      const div = document.createElement("div");
      div.className = "card";
      div.style.cursor = "pointer";

      div.innerHTML = `
        <strong>${e.date.split("-").reverse().join("/")}</strong>
        <p>${(e.text || "").substring(0, 100)}...</p>
      `;

      div.onclick = () => {
        datePicker.value = e.date;
        loadEntryForDate(e.date);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      entriesList.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    entriesList.innerHTML =
      "<p>⚠️ Erro ao carregar memórias.</p>";
  }
}

/* 📆 CALENDÁRIO VISUAL */
async function renderCalendar() {
  calendarEl.innerHTML = "";

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const totalDays = lastDay.getDate();
  const startWeekDay = firstDay.getDay();

  let filledDates = new Set();

  try {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${totalDays}`;

    const q = query(
      collection(db, "entries"),
      where("userId", "==", currentUser.uid),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const snap = await getDocs(q);
    filledDates = new Set(snap.docs.map(d => d.data().date));
  } catch (err) {
    console.warn("⚠️ Calendário sem marcações (índice não criado ainda)");
  }

  // Espaços vazios antes do dia 1
  for (let i = 0; i < startWeekDay; i++) {
    calendarEl.appendChild(document.createElement("div"));
  }

  // Dias do mês
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const div = document.createElement("div");
    div.className = "day";
    div.textContent = day;

    if (new Date(dateStr) > today) {
      div.classList.add("disabled");
    } else {
      if (filledDates.has(dateStr)) {
        div.classList.add("filled");
      }

      div.onclick = () => {
        datePicker.value = dateStr;
        loadEntryForDate(dateStr);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }

    calendarEl.appendChild(div);
  }
}
