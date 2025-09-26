// --- CONFIGURATION ---
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM ELEMENTS ---
const welcomeScreen = document.getElementById('welcome-screen');
const startAppBtn = document.getElementById('start-app-btn');
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const modalCloseBtn = document.querySelector('.modal-close-btn');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const authFeedback = document.getElementById('auth-feedback');
const appContainer = document.getElementById('app-container');
const userControls = document.getElementById('user-controls');
const userProfileMenu = document.getElementById('user-profile-menu');
const userProfileBtn = document.getElementById('user-profile-btn');
const userDropdown = document.getElementById('user-dropdown');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const fileInput = document.getElementById('file-input');
const leftPane = document.getElementById('left-pane');
const libraryView = document.getElementById('library-view');
const docViewer = document.getElementById('document-viewer');
const translationPanel = document.getElementById('translation-panel');
const backToLibraryBtn = document.getElementById('back-to-library-btn');
const languageSelect = document.getElementById('language-select');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const pageNavContainer = document.getElementById('page-nav-container');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const currentTranslationContent = document.getElementById('current-translation-content');
const historyContent = document.getElementById('translation-history-content');
const copyButton = document.getElementById('copy-button');
const exportButton = document.getElementById('export-button');

// --- DATABASE (Local IndexedDB) ---
const db = {
    _db: null,
    init: function() { return new Promise((resolve, reject) => { const request = indexedDB.open('DocuTranslateDB', 1); request.onerror = () => reject("Error opening database"); request.onsuccess = (event) => { this._db = event.target.result; resolve(); }; request.onupgradeneeded = (event) => { const db = event.target.result; if (!db.objectStoreNames.contains('books')) { db.createObjectStore('books', { keyPath: 'id', autoIncrement: true }); } }; }); },
    addBook: function(file) { return new Promise((resolve, reject) => { const transaction = this._db.transaction(['books'], 'readwrite'); const store = transaction.objectStore('books'); const book = { name: file.name, file: file, added_on: new Date() }; const request = store.add(book); request.onsuccess = () => resolve(request.result); request.onerror = () => reject("Error adding book"); }); },
    getBooks: function() { return new Promise((resolve) => { const transaction = this._db.transaction(['books'], 'readonly'); const store = transaction.objectStore('books'); const request = store.getAll(); request.onsuccess = () => resolve(request.result.sort((a, b) => b.added_on - a.added_on)); }); },
    getBook: function(id) { return new Promise((resolve) => { const transaction = this._db.transaction(['books'], 'readonly'); const store = transaction.objectStore('books'); const request = store.get(id); request.onsuccess = () => resolve(request.result); }); },
    deleteBook: function(id) { return new Promise((resolve) => { const transaction = this._db.transaction(['books'], 'readwrite'); const store = transaction.objectStore('books'); const request = store.delete(id); request.onsuccess = () => resolve(); }); }
};

// --- STATE MANAGEMENT ---
let translationLog = [];
let splitInstance = null;
let epubRendition = null;
let currentPdf = null;
let currentUser = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    startAppBtn.addEventListener('click', startApplication);
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user ?? null;
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(darkModeToggle) darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
});

function startApplication() {
    welcomeScreen.classList.add('fade-out');
    setTimeout(() => welcomeScreen.classList.add('hidden'), 500); // Hide after fade
    appContainer.classList.remove('hidden');
    appContainer.style.animation = 'fadeIn 0.5s ease forwards';
    initializeUI();
    updateUserUI();
    showLibraryView();
}

function initializeUI() {
    loginBtn.addEventListener('click', () => loginModal.classList.remove('hidden'));
    modalCloseBtn.addEventListener('click', () => loginModal.classList.add('hidden'));
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    userProfileBtn.addEventListener('click', () => userDropdown.classList.toggle('hidden'));
    darkModeToggle.addEventListener('click', toggleDarkMode);
    fileInput.addEventListener('change', handleFileSelect);
    backToLibraryBtn.addEventListener('click', showLibraryView);
    docViewer.addEventListener('mouseup', handleTextSelection);
    copyButton.addEventListener('click', handleCopy);
    exportButton.addEventListener('click', handleExport);
    tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
    pageNumInput.addEventListener('change', goToPage);
}

// --- AUTH & UI UPDATES ---
function updateUserUI() {
    if (currentUser) {
        loginBtn.classList.add('hidden');
        userProfileMenu.classList.remove('hidden');
        userEmailDisplay.textContent = currentUser.email;
    } else {
        loginBtn.classList.remove('hidden');
        userProfileMenu.classList.add('hidden');
    }
}
async function handleLogin(e) { e.preventDefault(); const email = emailInput.value; authFeedback.textContent = 'Sending you a magic link...'; const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }); if (error) { authFeedback.textContent = `Error: ${error.message}`; } else { authFeedback.textContent = `Success! Please check your email for a login link.`; } }
async function handleLogout() { await supabaseClient.auth.signOut(); currentUser = null; updateUserUI(); showToast("You have been logged out."); }
supabaseClient.auth.onAuthStateChange((event, session) => { currentUser = session?.user ?? null; updateUserUI(); if(event === 'SIGNED_IN') showToast(`Welcome, ${currentUser.email}!`); });

// --- VIEW & DATA HANDLING (Local DB) ---
async function renderLibraryView() {
    libraryView.innerHTML = '';
    const addBookCard = document.createElement('div');
    addBookCard.className = 'add-book-card';
    addBookCard.innerHTML = `<div class="book-card-icon"><i class="fa-solid fa-plus"></i></div><div class="book-card-title">Add New Book</div>`;
    addBookCard.onclick = () => fileInput.click();
    libraryView.appendChild(addBookCard);
    const books = await db.getBooks();
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.innerHTML = `<div class="book-card-icon"><i class="fa-solid fa-book"></i></div><div class="book-card-title">${book.name}</div><button class="delete-book-btn" title="Delete Book"><i class="fa-solid fa-trash-can"></i></button>`;
        bookCard.querySelector('.delete-book-btn').addEventListener('click', (e) => { e.stopPropagation(); if (confirm(`Are you sure you want to delete "${book.name}"?`)) { db.deleteBook(book.id).then(renderLibraryView); } });
        bookCard.addEventListener('click', () => openBook(book.id));
        libraryView.appendChild(bookCard);
    });
}
async function handleFileSelect(event) { const file = event.target.files[0]; if (!file) return; try { await db.addBook(file); showToast(`"${file.name}" was added to your library.`); renderLibraryView(); } catch (error) { showToast("Failed to add book to library."); } fileInput.value = ''; }
async function openBook(bookId) { const bookData = await db.getBook(bookId); if (!bookData || !bookData.file) return showToast("Error: Could not load book file."); docViewer.innerHTML = ''; translationLog = []; updateHistoryView(); showDocumentView(); const { file } = bookData; const extension = file.name.split('.').pop().toLowerCase(); if (extension === 'pdf') renderPdf(file); else if (extension === 'docx') renderDocx(file); else if (extension === 'epub') renderEpub(file); }
function showLibraryView() { if (splitInstance) splitInstance.destroy(); if (epubRendition) epubRendition.destroy(); splitInstance = epubRendition = currentPdf = null; libraryView.classList.remove('hidden'); docViewer.classList.add('hidden'); backToLibraryBtn.classList.add('hidden'); pageNavContainer.classList.add('hidden'); translationPanel.classList.add('hidden'); leftPane.classList.add('full-width'); renderLibraryView(); }
function showDocumentView() { translationPanel.classList.remove('hidden'); leftPane.classList.remove('full-width'); libraryView.classList.add('hidden'); docViewer.classList.remove('hidden'); backToLibraryBtn.classList.remove('hidden'); setTimeout(() => { splitInstance = Split(['#left-pane', '#translation-panel'], { sizes: [65, 35], minSize: 200, gutterSize: 8, cursor: 'col-resize' }); }, 0); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('theme', 'dark'); darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>'; } else { localStorage.setItem('theme', 'light'); darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>'; } }
function handleTabClick(event) { tabButtons.forEach(btn => btn.classList.remove('active')); tabContents.forEach(content => content.classList.remove('active')); const tabId = event.target.dataset.tab; event.target.classList.add('active'); document.getElementById(tabId).classList.add('active'); }
function handleTextSelection() { setTimeout(() => { const selectedText = window.getSelection().toString().trim(); if (selectedText.length > 2) getTranslation(selectedText); }, 100); }

// --- MAIN FUNCTIONALITY ---
async function getTranslation(textToTranslate) { currentTranslationContent.innerHTML = '<div class="loader"></div>'; copyButton.disabled = true; const targetLanguage = languageSelect.value; const prompt = `Translate the following text into natural and fluent ${targetLanguage}. Text to translate: "${textToTranslate}"`; try { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); if (!response.ok) throw new Error((await response.json()).error.message); const data = await response.json(); const translation = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No translation found."; currentTranslationContent.innerText = translation; copyButton.disabled = false; translationLog.unshift({ original: textToTranslate, translated: translation }); updateHistoryView(); } catch (error) { currentTranslationContent.innerText = `Error: ${error.message}`; } finally { exportButton.disabled = translationLog.length === 0; } }
function handleCopy() { const textToCopy = currentTranslationContent.innerText; navigator.clipboard.writeText(textToCopy).then(() => showToast('Copied to clipboard!')); }
function handleExport() { if (translationLog.length === 0) return showToast("No history to export."); let markdownContent = `# Translation History\n\n`; [...translationLog].reverse().forEach(item => { markdownContent += `## Original\n> ${item.original}\n\n**Translation**\n${item.translated}\n\n---\n\n`; }); const blob = new Blob([markdownContent], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'translation_history.md'; a.click(); URL.revokeObjectURL(a.href); showToast('History exported!'); }
function updateHistoryView() { historyContent.innerHTML = ''; if (translationLog.length === 0) { historyContent.innerHTML = `<div class="placeholder"><i class="fa-solid fa-clock-rotate-left"></i><p>Your history will appear here.</p></div>`; } else { translationLog.forEach(item => { const historyItem = document.createElement('div'); historyItem.className = 'history-item'; historyItem.innerHTML = `<div class="original-text">${item.original}</div><div class="translated-text">${item.translated}</div>`; historyContent.appendChild(historyItem); }); } }
function goToPage() { if (!currentPdf) return; const pageNum = parseInt(pageNumInput.value, 10); if (pageNum >= 1 && pageNum <= currentPdf.numPages) { document.querySelector(`.page-container:nth-child(${pageNum})`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else { showToast(`Invalid page number.`); } }

// --- FILE RENDERING ---
async function renderPdf(file) { const reader = new FileReader(); reader.onload = async function(e) { try { const typedarray = new Uint8Array(e.target.result); currentPdf = await pdfjsLib.getDocument(typedarray).promise; pageNavContainer.classList.remove('hidden'); pageCountSpan.textContent = `/ ${currentPdf.numPages}`; pageNumInput.max = currentPdf.numPages; pageNumInput.value = 1; for (let i = 1; i <= currentPdf.numPages; i++) { const page = await currentPdf.getPage(i); const viewport = page.getViewport({ scale: 1.8 }); const pageContainer = document.createElement('div'); pageContainer.className = 'page-container'; docViewer.appendChild(pageContainer); const canvas = document.createElement('canvas'); canvas.height = viewport.height; canvas.width = viewport.width; pageContainer.appendChild(canvas); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; const textContent = await page.getTextContent(); const textLayerDiv = document.createElement('div'); textLayerDiv.className = 'textLayer'; pageContainer.appendChild(textLayerDiv); pdfjsLib.renderTextLayer({ textContent, container: textLayerDiv, viewport, textDivs: [] }); } } catch(error) { docViewer.innerHTML = `<div class="placeholder"><i class="fa-solid fa-file-circle-exclamation"></i><p>Error loading PDF.</p></div>`; } }; reader.readAsArrayBuffer(file); }
function renderDocx(file) { pageNavContainer.classList.add('hidden'); docx.renderAsync(file, docViewer); }
function renderEpub(file) { pageNavContainer.classList.add('hidden'); docViewer.innerHTML = ''; docViewer.style.padding = '0'; const book = ePub(file); epubRendition = book.renderTo(docViewer, { width: "100%", height: "100%" }); epubRendition.display(); epubRendition.on("selected", (cfiRange) => { const selectedText = epubRendition.getRange(cfiRange).toString().trim(); if (selectedText.length > 2) { window.getSelection().empty(); getTranslation(selectedText); } }); }
function showToast(message) { const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; container.appendChild(toast); setTimeout(() => toast.remove(), 3000); }