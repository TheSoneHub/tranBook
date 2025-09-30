// --- CONFIGURATION ---
// Use the key from localStorage if available, otherwise fallback to config.js
function getGoogleApiKey() {
    return localStorage.getItem('google_ai_studio_api_key') || (typeof GOOGLE_AI_API_KEY !== 'undefined' ? GOOGLE_AI_API_KEY : '');
}

function getApiUrl() {
    const key = getGoogleApiKey();
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
}
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

// --- DOM ELEMENTS ---
const welcomeScreen = document.getElementById('welcome-screen');
const startAppBtn = document.getElementById('start-app-btn');
const appContainer = document.getElementById('app-container');
const fileInput = document.getElementById('file-input');
const leftPane = document.getElementById('left-pane');
const libraryView = document.getElementById('library-view');
const docViewer = document.getElementById('document-viewer');
const translationPanel = document.getElementById('translation-panel');
const backToLibraryBtn = document.getElementById('back-to-library-btn');
const languageSelect = document.getElementById('language-select');
const darkModeToggle = document.getElementById('dark-mode-toggle');
// Page Navigation Elements
const pageNavContainer = document.getElementById('page-nav-container');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count');
// Translation Panel Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const currentTranslationContent = document.getElementById('current-translation-content');
const historyContent = document.getElementById('translation-history-content');
const copyButton = document.getElementById('copy-button');
const exportButton = document.getElementById('export-button');

// --- DATABASE HELPER ---
const db = {
    _db: null,
    init: function() { /* ... No changes ... */ return new Promise((resolve, reject)=>{const request=indexedDB.open('DocuTranslateDB',1);request.onerror=()=>reject("Error opening database");request.onsuccess=(event)=>{this._db=event.target.result;resolve()};request.onupgradeneeded=(event)=>{const db=event.target.result;if(!db.objectStoreNames.contains('books')){db.createObjectStore('books',{keyPath:'id',autoIncrement:true})}}})},
    addBook: function(file) { /* ... No changes ... */ return new Promise((resolve,reject)=>{const transaction=this._db.transaction(['books'],'readwrite');const store=transaction.objectStore('books');const book={name:file.name,file:file,added_on:new Date()};const request=store.add(book);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject("Error adding book")})},
    getBooks: function() { /* ... No changes ... */ return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readonly');const store=transaction.objectStore('books');const request=store.getAll();request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.added_on-a.added_on))})},
    getBook: function(id) { /* ... No changes ... */ return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readonly');const store=transaction.objectStore('books');const request=store.get(id);request.onsuccess=()=>resolve(request.result)})},
    deleteBook: function(id) { /* ... No changes ... */ return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readwrite');const store=transaction.objectStore('books');const request=store.delete(id);request.onsuccess=()=>resolve()})}
};

// --- STATE MANAGEMENT ---
let translationLog = [];
let splitInstance = null;
let epubRendition = null;
let currentPdf = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    startAppBtn.addEventListener('click', startApplication);
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(darkModeToggle) darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
});

function startApplication() {
    welcomeScreen.classList.add('fade-out');
    appContainer.classList.remove('hidden');
    appContainer.style.animation = 'fadeIn 0.5s ease forwards';
    initializeUI();
    showLibraryView();
}

function initializeUI() {
    darkModeToggle.addEventListener('click', toggleDarkMode);
    fileInput.addEventListener('change', handleFileSelect);
    backToLibraryBtn.addEventListener('click', showLibraryView);
    docViewer.addEventListener('mouseup', handleTextSelection);
    copyButton.addEventListener('click', handleCopy);
    exportButton.addEventListener('click', handleExport);
    tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
    pageNumInput.addEventListener('change', goToPage);
}

// --- VIEW MANAGEMENT ---
async function renderLibraryView() { /* ... No changes ... */ libraryView.innerHTML = ''; const books = await db.getBooks(); const addBookCard = document.createElement('div'); addBookCard.className = 'add-book-card'; addBookCard.innerHTML = `<div class="book-card-icon"><i class="fa-solid fa-plus"></i></div> <div class="book-card-title">Add New Book</div>`; addBookCard.onclick = () => fileInput.click(); libraryView.appendChild(addBookCard); books.forEach(book => { const bookCard = document.createElement('div'); bookCard.className = 'book-card'; bookCard.innerHTML = ` <div class="book-card-icon"><i class="fa-solid fa-book"></i></div> <div class="book-card-title">${book.name}</div> <button class="delete-book-btn" title="Delete Book"><i class="fa-solid fa-trash-can"></i></button> `; bookCard.querySelector('.delete-book-btn').addEventListener('click', (e) => { e.stopPropagation(); if (confirm(`Are you sure you want to delete "${book.name}"?`)) { db.deleteBook(book.id).then(renderLibraryView); } }); bookCard.addEventListener('click', () => openBook(book.id)); libraryView.appendChild(bookCard); }); }

async function openBook(bookId) {
    const bookData = await db.getBook(bookId);
    if (!bookData || !bookData.file) return showToast("Error: Could not load book file.");
    
    docViewer.innerHTML = '';
    translationLog = [];
    updateHistoryView();
    
    showDocumentView();
    
    const { file } = bookData;
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'pdf') renderPdf(file);
    else if (extension === 'docx') renderDocx(file);
    else if (extension === 'epub') renderEpub(file);
}

function showLibraryView() {
    if (splitInstance) splitInstance.destroy();
    if (epubRendition) epubRendition.destroy();
    splitInstance = epubRendition = currentPdf = null;
    
    libraryView.classList.remove('hidden');
    docViewer.classList.add('hidden');
    backToLibraryBtn.classList.add('hidden');
    pageNavContainer.classList.add('hidden'); // Hide page nav
    
    translationPanel.classList.add('hidden');
    leftPane.classList.add('full-width');
    
    renderLibraryView();
}

function showDocumentView() {
    translationPanel.classList.remove('hidden');
    leftPane.classList.remove('full-width');
    libraryView.classList.add('hidden');
    docViewer.classList.remove('hidden');
    backToLibraryBtn.classList.remove('hidden');

    setTimeout(() => {
        splitInstance = Split(['#left-pane', '#translation-panel'], {
            sizes: [65, 35], minSize: 200, gutterSize: 8, cursor: 'col-resize'
        });
    }, 0);
}

// --- EVENT HANDLERS ---
async function handleFileSelect(event) { /* ... No changes ... */ const file = event.target.files[0]; if (!file) return; try { await db.addBook(file); showToast(`"${file.name}" was added to your library.`); renderLibraryView(); } catch (error) { showToast("Failed to add book to library."); console.error(error); } fileInput.value = ''; }
function handleTextSelection() { /* ... No changes ... */ setTimeout(() => { const selectedText = window.getSelection().toString().trim(); if (selectedText.length > 2) getTranslation(selectedText); }, 100); }
function handleTabClick(event) { /* ... No changes ... */ tabButtons.forEach(btn => btn.classList.remove('active')); tabContents.forEach(content => content.classList.remove('active')); const tabId = event.target.dataset.tab; event.target.classList.add('active'); document.getElementById(tabId).classList.add('active'); }
function toggleDarkMode() { /* ... No changes ... */ document.body.classList.toggle('dark-mode'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('theme', 'dark'); darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>'; } else { localStorage.setItem('theme', 'light'); darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>'; } }

// --- MAIN FUNCTIONALITY ---
async function getTranslation(textToTranslate) { /* ... No changes ... */ currentTranslationContent.innerHTML = '<div class="loader"></div>'; copyButton.disabled = true; const targetLanguage = languageSelect.value; const prompt = `Translate the following text into natural and fluent ${targetLanguage}. Maintain the original context and tone. Provide only the translated text without any additional explanations or labels. Text to translate: "${textToTranslate}"\n\n${targetLanguage} Translation:`; try { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); if (!response.ok) throw new Error((await response.json()).error.message); const data = await response.json(); const translation = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : "No translation found."; currentTranslationContent.innerText = translation; copyButton.disabled = false; translationLog.unshift({ original: textToTranslate, translated: translation }); updateHistoryView(); } catch (error) { currentTranslationContent.innerText = `Error: ${error.message}`; } finally { exportButton.disabled = translationLog.length === 0; } }
async function getTranslation(textToTranslate) { /* ...existing code...*/ currentTranslationContent.innerHTML = '<div class="loader"></div>'; copyButton.disabled = true; const targetLanguage = languageSelect.value; const prompt = `Translate the following text into natural and fluent ${targetLanguage}. Maintain the original context and tone. Provide only the translated text without any additional explanations or labels. Text to translate: "${textToTranslate}"\n\n${targetLanguage} Translation:`; try { const response = await fetch(getApiUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); if (!response.ok) throw new Error((await response.json()).error.message); const data = await response.json(); const translation = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : "No translation found."; currentTranslationContent.innerText = translation; copyButton.disabled = false; translationLog.unshift({ original: textToTranslate, translated: translation }); updateHistoryView(); } catch (error) { currentTranslationContent.innerText = `Error: ${error.message}`; } finally { exportButton.disabled = translationLog.length === 0; } }
function handleCopy() { /* ... No changes ... */ const textToCopy = currentTranslationContent.innerText; navigator.clipboard.writeText(textToCopy).then(() => showToast('Copied to clipboard!')); }
function handleExport() { /* ... No changes ... */ if (translationLog.length === 0) return showToast("No history to export."); let markdownContent = `# Translation History\n\n`; [...translationLog].reverse().forEach(item => { markdownContent += `## Original\n> ${item.original}\n\n**Translation (${languageSelect.value})**\n${item.translated}\n\n---\n\n`; }); const blob = new Blob([markdownContent], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'translation_history.md'; a.click(); URL.revokeObjectURL(a.href); showToast('History exported!'); }
function updateHistoryView() { /* ... No changes ... */ historyContent.innerHTML = ''; if (translationLog.length === 0) { historyContent.innerHTML = `<div class="placeholder"><i class="fa-solid fa-clock-rotate-left"></i><p>Your translation history for this session will appear here.</p></div>`; } else { translationLog.forEach(item => { const historyItem = document.createElement('div'); historyItem.className = 'history-item'; historyItem.innerHTML = `<div class="original-text">${item.original}</div><div class="translated-text">${item.translated}</div>`; historyContent.appendChild(historyItem); }); } }

// --- PAGE NAVIGATION & FILE RENDERING ---
function goToPage() {
    if (!currentPdf) return;
    const pageNum = parseInt(pageNumInput.value, 10);
    if (pageNum >= 1 && pageNum <= currentPdf.numPages) {
        document.querySelector(`.page-container:nth-child(${pageNum})`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        showToast(`Invalid page number. Please enter a number between 1 and ${currentPdf.numPages}.`);
    }
}

async function renderPdf(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const typedarray = new Uint8Array(e.target.result);
            currentPdf = await pdfjsLib.getDocument(typedarray).promise;
            
            // Show Page Navigation
            pageNavContainer.classList.remove('hidden');
            pageCountSpan.textContent = `/ ${currentPdf.numPages}`;
            pageNumInput.max = currentPdf.numPages;
            pageNumInput.value = 1;

            for (let i = 1; i <= currentPdf.numPages; i++) {
                const page = await currentPdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.8 });
                const pageContainer = document.createElement('div');
                pageContainer.className = 'page-container';
                docViewer.appendChild(pageContainer);
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height; canvas.width = viewport.width;
                pageContainer.appendChild(canvas);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                const textContent = await page.getTextContent();
                const textLayerDiv = document.createElement('div');
                textLayerDiv.className = 'textLayer'; pageContainer.appendChild(textLayerDiv);
                pdfjsLib.renderTextLayer({ textContent, container: textLayerDiv, viewport, textDivs: [] });
            }
        } catch(error) {
            docViewer.innerHTML = `<div class="placeholder"><i class="fa-solid fa-file-circle-exclamation"></i><p>Error loading PDF: ${error.message}</p></div>`;
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderDocx(file) {
    pageNavContainer.classList.add('hidden'); // Hide page nav for non-PDFs
    docx.renderAsync(file, docViewer);
}

async function renderEpub(file) {
    pageNavContainer.classList.add('hidden'); // Hide page nav for non-PDFs
    docViewer.innerHTML = ''; docViewer.style.padding = '0';
    const book = ePub(file);
    epubRendition = book.renderTo(docViewer, { width: "100%", height: "100%" });
    
    epubRendition.display();
    epubRendition.on("selected", (cfiRange) => {
        const selectedText = epubRendition.getRange(cfiRange).toString().trim();
        if (selectedText.length > 2) {
            window.getSelection().empty();
            getTranslation(selectedText);
        }
    });
}

function showToast(message) { /* ... No changes ... */ const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; container.appendChild(toast); setTimeout(() => toast.remove(), 3000); }