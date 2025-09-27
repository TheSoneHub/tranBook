// --- CONFIGURATION ---
// Use local fallback when Netlify function is not available
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'https://api.openai.com/v1/chat/completions' // Fallback for local development
    : `/.netlify/functions/translate`; // Production Netlify function

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

// --- SECURITY CONSTANTS ---
const SECURITY_CONFIG = {
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_FILE_TYPES: ['pdf', 'docx', 'epub'],
    MAX_TRANSLATION_LENGTH: 10000, // 10,000 characters
    MAX_HISTORY_ITEMS: 100,
    SANITIZE_REGEX: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ALLOWED_HTML_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'div', 'span']
};

// --- SECURITY UTILITIES ---
function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    
    // Remove script tags and other dangerous content
    let sanitized = str.replace(SECURITY_CONFIG.SANITIZE_REGEX, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    // Escape HTML entities
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    return sanitized;
}

function validateFile(file) {
    if (!file) return { valid: false, error: 'No file provided' };
    
    // Check file size
    if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
        return { 
            valid: false, 
            error: `File too large. Maximum size is ${Math.round(SECURITY_CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB` 
        };
    }
    
    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(extension)) {
        return { 
            valid: false, 
            error: `Invalid file type. Allowed types: ${SECURITY_CONFIG.ALLOWED_FILE_TYPES.join(', ')}` 
        };
    }
    
    // Check for suspicious file names
    const suspiciousPatterns = /\.(exe|bat|cmd|scr|pif|com|js|vbs|jar|sh|ps1)$/i;
    if (suspiciousPatterns.test(file.name)) {
        return { valid: false, error: 'Suspicious file type detected' };
    }
    
    return { valid: true };
}

function validateTextInput(text) {
    if (typeof text !== 'string') return { valid: false, error: 'Invalid text input' };
    
    if (text.length > SECURITY_CONFIG.MAX_TRANSLATION_LENGTH) {
        return { 
            valid: false, 
            error: `Text too long. Maximum length is ${SECURITY_CONFIG.MAX_TRANSLATION_LENGTH} characters` 
        };
    }
    
    // Check for potentially malicious content
    if (SECURITY_CONFIG.SANITIZE_REGEX.test(text)) {
        return { valid: false, error: 'Invalid content detected' };
    }
    
    return { valid: true };
}

function safeSetInnerHTML(element, content) {
    if (!element || typeof content !== 'string') return;
    element.textContent = sanitizeHTML(content);
}

function safeSetHTML(element, content) {
    if (!element || typeof content !== 'string') return;
    element.innerHTML = sanitizeHTML(content);
}

// --- MOCK TRANSLATION SERVICE FOR LOCAL DEVELOPMENT ---
async function getMockTranslation(text, targetLanguage) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple mock translations for demonstration
    const mockTranslations = {
        'Burmese': {
            'hello': 'မင်္ဂလာပါ',
            'world': 'ကမ္ဘာ',
            'thank you': 'ကျေးဇူးတင်ပါတယ်',
            'good morning': 'မင်္ဂလာပါ',
            'how are you': 'နေကောင်းလား',
            'book': 'စာအုပ်',
            'read': 'ဖတ်',
            'translate': 'ဘာသာပြန်',
            'document': 'စာရွက်စာတမ်း',
            'text': 'စာသား'
        },
        'English': {
            'မင်္ဂလာပါ': 'Hello',
            'ကမ္ဘာ': 'World',
            'ကျေးဇူးတင်ပါတယ်': 'Thank you',
            'စာအုပ်': 'Book',
            'ဖတ်': 'Read',
            'ဘာသာပြန်': 'Translate',
            'စာရွက်စာတမ်း': 'Document',
            'စာသား': 'Text'
        },
        'Japanese': {
            'hello': 'こんにちは',
            'world': '世界',
            'thank you': 'ありがとうございます',
            'good morning': 'おはようございます',
            'how are you': 'お元気ですか',
            'book': '本',
            'read': '読む',
            'translate': '翻訳',
            'document': '文書',
            'text': 'テキスト'
        }
    };
    
    const languageMap = mockTranslations[targetLanguage] || mockTranslations['English'];
    const lowerText = text.toLowerCase().trim();
    
    // Check for exact matches first
    if (languageMap[lowerText]) {
        return languageMap[lowerText];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(languageMap)) {
        if (lowerText.includes(key) || key.includes(lowerText)) {
            return value;
        }
    }
    
    // Default mock translation
    return `[${targetLanguage} Translation]: ${text}`;
}

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
// Document Controls
const documentControls = document.getElementById('document-controls');
const pageNavContainer = document.getElementById('page-nav-container');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomLevelDisplay = document.getElementById('zoom-level-display');
const fitWidthBtn = document.getElementById('fit-width-btn');
const fitPageBtn = document.getElementById('fit-page-btn');
const selectionModeIndicator = document.getElementById('selection-mode-indicator');
const selectionModeText = document.getElementById('selection-mode-text');
const selectionModeBtn = document.getElementById('selection-mode-btn');
// Translation Panel
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const currentTranslationContent = document.getElementById('current-translation-content');
const historyContent = document.getElementById('translation-history-content');
const copyButton = document.getElementById('copy-button');
const exportButton = document.getElementById('export-button');

// --- DATABASE HELPER ---
const db = {
    _db: null,
    init: function() { return new Promise((resolve, reject)=>{const request=indexedDB.open('DocuTranslateDB',1);request.onerror=()=>reject("Error opening database");request.onsuccess=(event)=>{this._db=event.target.result;resolve()};request.onupgradeneeded=(event)=>{const db=event.target.result;if(!db.objectStoreNames.contains('books')){db.createObjectStore('books',{keyPath:'id',autoIncrement:true})}}})},
    addBook: function(file) { return new Promise((resolve,reject)=>{const transaction=this._db.transaction(['books'],'readwrite');const store=transaction.objectStore('books');const book={name:file.name,file:file,added_on:new Date()};const request=store.add(book);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject("Error adding book")})},
    getBooks: function() { return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readonly');const store=transaction.objectStore('books');const request=store.getAll();request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.added_on-a.added_on))})},
    getBook: function(id) { return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readonly');const store=transaction.objectStore('books');const request=store.get(id);request.onsuccess=()=>resolve(request.result)})},
    deleteBook: function(id) { return new Promise((resolve)=>{const transaction=this._db.transaction(['books'],'readwrite');const store=transaction.objectStore('books');const request=store.delete(id);request.onsuccess=()=>resolve()})}
};

// --- STATE MANAGEMENT ---
let translationLog = [];
let splitInstance = null;
let epubRendition = null;
let pdfState = { pdfDoc: null, scale: 1.5, currentPage: 1, numPages: 0 };
let zoomState = { 
    scale: 1.0, 
    minScale: 0.25, 
    maxScale: 4.0, 
    defaultScale: 1.0,
    currentDocumentType: null,
    fitMode: 'none' // 'none', 'width', 'page'
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure icons load properly
    ensureIconsLoad();
    
    startAppBtn.addEventListener('click', startApplication);
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(darkModeToggle) darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
});

// --- ICON LOADING UTILITIES ---
function ensureIconsLoad() {
    // Check if Font Awesome is loaded
    setTimeout(() => {
        const testIcon = document.createElement('i');
        testIcon.className = 'fa-solid fa-magnifying-glass-plus';
        testIcon.style.visibility = 'hidden';
        testIcon.style.position = 'absolute';
        document.body.appendChild(testIcon);
        
        const computedStyle = window.getComputedStyle(testIcon, ':before');
        const hasIcon = computedStyle.content !== 'none' && computedStyle.content !== '""';
        
        if (!hasIcon) {
            console.warn('Font Awesome not loaded, using fallback icons');
            addFallbackIcons();
        }
        
        document.body.removeChild(testIcon);
    }, 1000);
}

function addFallbackIcons() {
    // Add fallback icons to all buttons
    const iconMappings = {
        'fa-magnifying-glass-plus': '⊕',
        'fa-magnifying-glass-minus': '⊖',
        'fa-arrows-left-right': '↔',
        'fa-expand': '⛶',
        'fa-plus': '+',
        'fa-book': '📖',
        'fa-trash-can': '🗑',
        'fa-arrow-left': '←',
        'fa-arrow-right': '→',
        'fa-moon': '🌙',
        'fa-sun': '☀',
        'fa-copy': '📋',
        'fa-download': '⬇',
        'fa-wand-magic-sparkles': '✨',
        'fa-clock-rotate-left': '🕐',
        'fa-file-circle-exclamation': '⚠',
        'fa-spinner': '⏳'
    };
    
    Object.entries(iconMappings).forEach(([className, fallback]) => {
        const icons = document.querySelectorAll(`.${className}`);
        icons.forEach(icon => {
            if (!icon.textContent.trim()) {
                icon.textContent = fallback;
                icon.style.fontFamily = 'Arial, sans-serif';
            }
        });
    });
}

async function startApplication() {
    startAppBtn.disabled = true;
    startAppBtn.innerHTML = 'Initializing... <i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await db.init();
        welcomeScreen.classList.add('fade-out');
        appContainer.classList.remove('hidden');
        appContainer.style.animation = 'fadeIn 0.5s ease forwards';
        initializeUI();
        showLibraryView();
    } catch (error) {
        console.error("Database initialization failed:", error);
        startAppBtn.disabled = false;
        startAppBtn.innerHTML = 'Get Started <i class="fa-solid fa-arrow-right"></i>';
        showToast("Error: Could not initialize local library. Please check browser permissions.");
    }
}

function initializeUI() {
    darkModeToggle.addEventListener('click', toggleDarkMode);
    fileInput.addEventListener('change', handleFileSelect);
    backToLibraryBtn.addEventListener('click', showLibraryView);
    docViewer.addEventListener('mouseup', handleTextSelection);
    docViewer.addEventListener('contextmenu', handleContextMenu);
    copyButton.addEventListener('click', handleCopy);
    exportButton.addEventListener('click', handleExport);
    tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
    pageNumInput.addEventListener('change', handleGoToPage);
    
    // Zoom controls
    zoomInBtn.addEventListener('click', handleZoomIn);
    zoomOutBtn.addEventListener('click', handleZoomOut);
    zoomResetBtn.addEventListener('click', handleZoomReset);
    fitWidthBtn.addEventListener('click', handleFitWidth);
    fitPageBtn.addEventListener('click', handleFitPage);
    
    // Keyboard shortcuts for zoom
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Touch/mouse wheel zoom
    docViewer.addEventListener('wheel', handleWheelZoom, { passive: false });
    
    // Touch gestures for mobile
    let touchStartDistance = 0;
    docViewer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            touchStartDistance = getTouchDistance(e.touches);
        }
    });
    
    docViewer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const touchDistance = getTouchDistance(e.touches);
            const scaleChange = touchDistance / touchStartDistance;
            if (Math.abs(scaleChange - 1) > 0.1) {
                const newScale = zoomState.scale * scaleChange;
                setZoomLevel(newScale, true);
                touchStartDistance = touchDistance;
            }
        }
    }, { passive: false });
    
    // Selection mode button
    if (selectionModeBtn) {
        selectionModeBtn.addEventListener('click', showSelectionModeMenu);
    }
    
    // Click outside to clear selection
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.selection-context-menu') && !e.target.closest('#document-viewer')) {
            clearSelectionHighlight();
            hideContextMenu();
        }
    });
}

// --- VIEW MANAGEMENT ---
async function renderLibraryView() {
    libraryView.innerHTML = '';
    const books = await db.getBooks();
    const addBookCard = document.createElement('div');
    addBookCard.className = 'add-book-card';
    addBookCard.innerHTML = `<div class="book-card-icon"><i class="fa-solid fa-plus"></i></div> <div class="book-card-title">Add New Book</div>`;
    addBookCard.onclick = () => fileInput.click();
    libraryView.appendChild(addBookCard);
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        
        // Create elements safely without innerHTML
        const iconDiv = document.createElement('div');
        iconDiv.className = 'book-card-icon';
        iconDiv.innerHTML = '<i class="fa-solid fa-book"></i>';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'book-card-title';
        titleDiv.textContent = sanitizeHTML(book.name || 'Unknown');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-book-btn';
        deleteBtn.title = 'Delete Book';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const safeName = sanitizeHTML(book.name || 'this book');
            if (confirm(`Are you sure you want to delete "${safeName}"?`)) {
                db.deleteBook(book.id).then(renderLibraryView);
            }
        });
        
        bookCard.appendChild(iconDiv);
        bookCard.appendChild(titleDiv);
        bookCard.appendChild(deleteBtn);
        bookCard.addEventListener('click', () => openBook(book.id));
        libraryView.appendChild(bookCard);
    });
}

async function openBook(bookId) {
    const bookData = await db.getBook(bookId);
    if (!bookData || !bookData.file) return showToast("Error: Could not load book file.");
    
    docViewer.innerHTML = '<div class="loader"></div>';
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
    splitInstance = epubRendition = pdfState.pdfDoc = null;
    zoomState.currentDocumentType = null;
    
    libraryView.classList.remove('hidden');
    docViewer.classList.add('hidden');
    backToLibraryBtn.classList.add('hidden');
    documentControls.classList.add('hidden');
    
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
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file before processing
    const validation = validateFile(file);
    if (!validation.valid) {
        showToast(`Error: ${validation.error}`);
        fileInput.value = '';
        return;
    }
    
    try {
        await db.addBook(file);
        showToast(`"${sanitizeHTML(file.name)}" was added to your library.`);
        renderLibraryView();
    } catch (error) {
        showToast("Failed to add book to library.");
        console.error(error);
    }
    fileInput.value = '';
}

// --- ENHANCED TEXT SELECTION ---
let selectionState = {
    isSelecting: false,
    selectionStart: null,
    selectionEnd: null,
    lastSelection: '',
    selectionMode: 'auto' // 'auto', 'word', 'sentence', 'paragraph'
};

function handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        selectionState.isSelecting = true;
        selectionState.selectionStart = selection.anchorOffset;
        selectionState.selectionEnd = selection.focusOffset;
        
        // Show selection mode indicator
        showSelectionModeIndicator();
        
        // Add visual feedback
        addSelectionHighlight(selection);
        
        // Auto-translate based on selection mode
        if (selectedText.length > 2) {
            const validation = validateTextInput(selectedText);
            if (validation.valid) {
                // Smart selection based on current mode
                const processedText = processSelectionByMode(selectedText, selection);
                if (processedText !== selectionState.lastSelection) {
                    selectionState.lastSelection = processedText;
                    getTranslation(processedText);
                }
            } else {
                showToast(`Error: ${validation.error}`);
            }
        }
    } else {
        clearSelectionHighlight();
        hideSelectionModeIndicator();
        selectionState.isSelecting = false;
    }
}

function processSelectionByMode(selectedText, selection) {
    switch (selectionState.selectionMode) {
        case 'word':
            return getFullWord(selection);
        case 'sentence':
            return getCompleteSentence(selectedText, selection);
        case 'paragraph':
            return getCompleteParagraph(selectedText, selection);
        case 'auto':
        default:
            return getSmartSelection(selectedText, selection);
    }
}

function showSelectionModeIndicator() {
    if (selectionModeIndicator) {
        selectionModeIndicator.classList.remove('hidden');
        updateSelectionModeDisplay();
    }
}

function hideSelectionModeIndicator() {
    if (selectionModeIndicator) {
        selectionModeIndicator.classList.add('hidden');
    }
}

function updateSelectionModeDisplay() {
    if (selectionModeText) {
        const modeNames = {
            'word': 'Word',
            'sentence': 'Sentence', 
            'paragraph': 'Paragraph',
            'auto': 'Auto'
        };
        selectionModeText.textContent = modeNames[selectionState.selectionMode] || 'Auto';
    }
    
    if (selectionModeBtn) {
        const modeIcons = {
            'word': '📝',
            'sentence': '📄',
            'paragraph': '📋',
            'auto': '🤖'
        };
        selectionModeBtn.textContent = modeIcons[selectionState.selectionMode] || '🤖';
    }
}

function showSelectionModeMenu() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        // Create a simple mode selection menu
        const modes = [
            { mode: 'auto', icon: '🤖', text: 'Auto' },
            { mode: 'word', icon: '📝', text: 'Word' },
            { mode: 'sentence', icon: '📄', text: 'Sentence' },
            { mode: 'paragraph', icon: '📋', text: 'Paragraph' }
        ];
        
        const menu = document.createElement('div');
        menu.className = 'selection-context-menu';
        menu.style.position = 'absolute';
        menu.style.top = '50px';
        menu.style.left = '0';
        
        modes.forEach(mode => {
            const btn = document.createElement('button');
            btn.innerHTML = `${mode.icon} ${mode.text}`;
            btn.onclick = () => {
                selectionState.selectionMode = mode.mode;
                updateSelectionModeDisplay();
                handleSelectionModeChange(selectedText);
                menu.remove();
            };
            if (selectionState.selectionMode === mode.mode) {
                btn.style.background = 'linear-gradient(145deg, var(--accent-color), #0056b3)';
                btn.style.color = 'white';
            }
            menu.appendChild(btn);
        });
        
        selectionModeIndicator.appendChild(menu);
        
        // Remove menu after 3 seconds or click outside
        setTimeout(() => {
            if (menu.parentNode) {
                menu.remove();
            }
        }, 3000);
    }
}

function getSmartSelection(text, selection) {
    // Auto-detect selection type and improve it
    const words = text.split(/\s+/);
    
    if (words.length === 1) {
        // Single word - try to get full word
        return getFullWord(selection);
    } else if (words.length <= 3) {
        // Short phrase - keep as is
        return text;
    } else if (words.length <= 10) {
        // Medium phrase - check for sentence boundaries
        return getCompleteSentence(text, selection);
    } else {
        // Long selection - might be paragraph
        return text;
    }
}

function getFullWord(selection) {
    try {
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        const text = textNode.textContent;
        const start = range.startOffset;
        
        // Find word boundaries
        let wordStart = start;
        let wordEnd = start;
        
        // Go backwards to find word start
        while (wordStart > 0 && /\w/.test(text[wordStart - 1])) {
            wordStart--;
        }
        
        // Go forwards to find word end
        while (wordEnd < text.length && /\w/.test(text[wordEnd])) {
            wordEnd++;
        }
        
        return text.substring(wordStart, wordEnd).trim();
    } catch (e) {
        return selection.toString().trim();
    }
}

function getCompleteSentence(text, selection) {
    try {
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        const fullText = textNode.textContent;
        const start = range.startOffset;
        
        // Find sentence boundaries
        let sentenceStart = start;
        let sentenceEnd = start;
        
        // Go backwards to find sentence start
        while (sentenceStart > 0 && !/[.!?]\s/.test(fullText.substring(sentenceStart - 2, sentenceStart + 1))) {
            sentenceStart--;
        }
        
        // Go forwards to find sentence end
        while (sentenceEnd < fullText.length && !/[.!?]\s/.test(fullText.substring(sentenceEnd - 1, sentenceEnd + 2))) {
            sentenceEnd++;
        }
        
        const sentence = fullText.substring(sentenceStart, sentenceEnd).trim();
        return sentence.length > 0 ? sentence : text;
    } catch (e) {
        return text;
    }
}

function addSelectionHighlight(selection) {
    // Remove existing highlights
    clearSelectionHighlight();
    
    try {
        const range = selection.getRangeAt(0);
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'selection-highlight';
        highlightSpan.style.cssText = `
            background: linear-gradient(120deg, rgba(0, 123, 255, 0.2), rgba(0, 123, 255, 0.1));
            border-radius: 4px;
            padding: 2px 4px;
            margin: 0 1px;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
            animation: selectionPulse 0.5s ease-out;
        `;
        
        range.surroundContents(highlightSpan);
    } catch (e) {
        // If surroundContents fails, just add a visual indicator
        console.log('Selection highlight added');
    }
}

function clearSelectionHighlight() {
    const highlights = document.querySelectorAll('.selection-highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
    });
}

// --- CONTEXT MENU AND SELECTION MODES ---
function handleContextMenu(e) {
    e.preventDefault();
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        showContextMenu(e, selectedText);
    }
}

function showContextMenu(e, selectedText) {
    hideContextMenu(); // Remove existing menu
    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'selection-context-menu';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = (e.pageY - 10) + 'px';
    
    // Selection mode buttons
    const modeButtons = [
        { mode: 'word', icon: '📝', text: 'Word' },
        { mode: 'sentence', icon: '📄', text: 'Sentence' },
        { mode: 'paragraph', icon: '📋', text: 'Paragraph' },
        { mode: 'auto', icon: '🤖', text: 'Auto' }
    ];
    
    modeButtons.forEach(button => {
        const btn = document.createElement('button');
        btn.innerHTML = `${button.icon} ${button.text}`;
        btn.title = `Select ${button.text.toLowerCase()} mode`;
        btn.onclick = () => {
            selectionState.selectionMode = button.mode;
            handleSelectionModeChange(selectedText);
            hideContextMenu();
        };
        if (selectionState.selectionMode === button.mode) {
            btn.style.background = 'linear-gradient(145deg, var(--accent-color), #0056b3)';
            btn.style.color = 'white';
        }
        contextMenu.appendChild(btn);
    });
    
    // Quick actions
    const quickActions = [
        { action: 'translate', icon: '🌐', text: 'Translate' },
        { action: 'copy', icon: '📋', text: 'Copy' },
        { action: 'search', icon: '🔍', text: 'Search' }
    ];
    
    quickActions.forEach(action => {
        const btn = document.createElement('button');
        btn.innerHTML = `${action.icon} ${action.text}`;
        btn.title = action.text;
        btn.onclick = () => {
            handleQuickAction(action.action, selectedText);
            hideContextMenu();
        };
        contextMenu.appendChild(btn);
    });
    
    document.body.appendChild(contextMenu);
    
    // Position menu to stay within viewport
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = (e.pageX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (e.pageY - rect.height - 10) + 'px';
    }
}

function hideContextMenu() {
    const existingMenu = document.querySelector('.selection-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
}

function handleSelectionModeChange(selectedText) {
    const selection = window.getSelection();
    let processedText = selectedText;
    
    switch (selectionState.selectionMode) {
        case 'word':
            processedText = getFullWord(selection);
            break;
        case 'sentence':
            processedText = getCompleteSentence(selectedText, selection);
            break;
        case 'paragraph':
            processedText = getCompleteParagraph(selectedText, selection);
            break;
        case 'auto':
        default:
            processedText = getSmartSelection(selectedText, selection);
            break;
    }
    
    if (processedText !== selectedText) {
        // Update selection with processed text
        selectionState.lastSelection = processedText;
        getTranslation(processedText);
        showToast(`Selection mode: ${selectionState.selectionMode}`);
    }
}

function getCompleteParagraph(text, selection) {
    try {
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        const fullText = textNode.textContent;
        const start = range.startOffset;
        
        // Find paragraph boundaries (double newlines or significant spacing)
        let paragraphStart = start;
        let paragraphEnd = start;
        
        // Go backwards to find paragraph start
        while (paragraphStart > 0 && !/\n\s*\n/.test(fullText.substring(paragraphStart - 3, paragraphStart + 1))) {
            paragraphStart--;
        }
        
        // Go forwards to find paragraph end
        while (paragraphEnd < fullText.length && !/\n\s*\n/.test(fullText.substring(paragraphEnd - 1, paragraphEnd + 3))) {
            paragraphEnd++;
        }
        
        const paragraph = fullText.substring(paragraphStart, paragraphEnd).trim();
        return paragraph.length > 0 ? paragraph : text;
    } catch (e) {
        return text;
    }
}

function handleQuickAction(action, selectedText) {
    switch (action) {
        case 'translate':
            getTranslation(selectedText);
            break;
        case 'copy':
            navigator.clipboard.writeText(selectedText).then(() => {
                showToast('Text copied to clipboard!');
            });
            break;
        case 'search':
            // Open search in new tab
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`;
            window.open(searchUrl, '_blank');
            break;
    }
}

function handleTabClick(event) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    const tabId = event.target.dataset.tab;
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    darkModeToggle.innerHTML = isDarkMode ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// --- MAIN FUNCTIONALITY ---
async function getTranslation(textToTranslate) {
    // Validate input before processing
    const inputValidation = validateTextInput(textToTranslate);
    if (!inputValidation.valid) {
        showToast(`Error: ${inputValidation.error}`);
        return;
    }
    
    currentTranslationContent.innerHTML = '<div class="loader"></div>';
    copyButton.disabled = true;
    const targetLanguage = languageSelect.value;
    
    try {
        // Determine if we're using local development or production
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        let requestBody, headers;
        
        if (isLocal) {
            // For local development, use a mock translation service
            const mockTranslation = await getMockTranslation(textToTranslate, targetLanguage);
            currentTranslationContent.textContent = mockTranslation;
            copyButton.disabled = false;
            
            // Add to history
            translationLog.unshift({ 
                original: sanitizeHTML(textToTranslate), 
                translated: sanitizeHTML(mockTranslation) 
            });
            if (translationLog.length > SECURITY_CONFIG.MAX_HISTORY_ITEMS) {
                translationLog = translationLog.slice(0, SECURITY_CONFIG.MAX_HISTORY_ITEMS);
            }
            updateHistoryView();
            exportButton.disabled = translationLog.length === 0;
            return;
        } else {
            // For production, use Netlify function
            headers = { 'Content-Type': 'application/json' };
            requestBody = JSON.stringify({ 
                textToTranslate: sanitizeHTML(textToTranslate), 
                targetLanguage: sanitizeHTML(targetLanguage) 
            });
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: requestBody
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Translation request failed');
        }

        const data = await response.json();
        const translation = data.translation || "No translation found.";
        
        // Validate and sanitize translation response
        const translationValidation = validateTextInput(translation);
        if (!translationValidation.valid) {
            throw new Error('Invalid translation response received');
        }

        currentTranslationContent.textContent = sanitizeHTML(translation);
        copyButton.disabled = false;
        
        // Limit history size for security
        translationLog.unshift({ 
            original: sanitizeHTML(textToTranslate), 
            translated: sanitizeHTML(translation) 
        });
        if (translationLog.length > SECURITY_CONFIG.MAX_HISTORY_ITEMS) {
            translationLog = translationLog.slice(0, SECURITY_CONFIG.MAX_HISTORY_ITEMS);
        }
        updateHistoryView();

    } catch (error) {
        currentTranslationContent.textContent = `Error: ${sanitizeHTML(error.message)}`;
        console.error("Translation Error:", error);
    } finally {
        exportButton.disabled = translationLog.length === 0;
    }
}

function handleCopy() {
    const textToCopy = currentTranslationContent.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => showToast('Copied to clipboard!'));
}

function handleExport() {
    if (translationLog.length === 0) return showToast("No history to export.");
    let markdownContent = `# Translation History\n\n`;
    [...translationLog].reverse().forEach(item => {
        markdownContent += `## Original\n> ${item.original}\n\n**Translation (${languageSelect.value})**\n${item.translated}\n\n---\n\n`;
    });
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'translation_history.md';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('History exported!');
}

function updateHistoryView() {
    historyContent.innerHTML = '';
    if (translationLog.length === 0) {
        historyContent.innerHTML = `<div class="placeholder"><i class="fa-solid fa-clock-rotate-left"></i><p>Your translation history for this session will appear here.</p></div>`;
    } else {
        translationLog.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const originalDiv = document.createElement('div');
            originalDiv.className = 'original-text';
            originalDiv.textContent = item.original || '';
            
            const translatedDiv = document.createElement('div');
            translatedDiv.className = 'translated-text';
            translatedDiv.textContent = item.translated || '';
            
            historyItem.appendChild(originalDiv);
            historyItem.appendChild(translatedDiv);
            historyContent.appendChild(historyItem);
        });
    }
}

// --- UNIVERSAL ZOOM FUNCTIONALITY ---
function setZoomLevel(scale, updateControls = true) {
    const clampedScale = Math.max(zoomState.minScale, Math.min(zoomState.maxScale, scale));
    zoomState.scale = clampedScale;
    
    if (updateControls) {
        updateZoomControls();
    }
    
    applyZoomToDocument();
}

function applyZoomToDocument() {
    if (!zoomState.currentDocumentType) return;
    
    switch (zoomState.currentDocumentType) {
        case 'pdf':
            pdfState.scale = zoomState.scale * 1.5; // PDF has different base scale
            if (pdfState.pdfDoc) {
                renderAllPdfPages();
            }
            break;
        case 'docx':
        case 'epub':
            const content = docViewer.querySelector('.docx-content, .epub-content');
            if (content) {
                content.style.transform = `scale(${zoomState.scale})`;
                content.style.width = `${100 / zoomState.scale}%`;
                content.style.height = `${100 / zoomState.scale}%`;
            }
            break;
    }
}

function updateZoomControls() {
    const percentage = Math.round(zoomState.scale * 100);
    zoomResetBtn.textContent = `${percentage}%`;
    zoomLevelDisplay.textContent = `${percentage}%`;
    
    // Update button states
    zoomOutBtn.disabled = zoomState.scale <= zoomState.minScale;
    zoomInBtn.disabled = zoomState.scale >= zoomState.maxScale;
    
    // Update fit mode buttons
    fitWidthBtn.classList.toggle('active', zoomState.fitMode === 'width');
    fitPageBtn.classList.toggle('active', zoomState.fitMode === 'page');
}

function handleZoomIn() {
    const newScale = Math.min(zoomState.maxScale, zoomState.scale + 0.25);
    setZoomLevel(newScale);
    zoomState.fitMode = 'none';
}

function handleZoomOut() {
    const newScale = Math.max(zoomState.minScale, zoomState.scale - 0.25);
    setZoomLevel(newScale);
    zoomState.fitMode = 'none';
}

function handleZoomReset() {
    setZoomLevel(zoomState.defaultScale);
    zoomState.fitMode = 'none';
}

function handleFitWidth() {
    if (zoomState.currentDocumentType === 'pdf' && pdfState.pdfDoc) {
        const containerWidth = docViewer.clientWidth - 40; // Account for margins
        const firstPage = docViewer.querySelector('.page-container canvas');
        if (firstPage) {
            const pageWidth = firstPage.width / pdfState.scale;
            const newScale = (containerWidth / pageWidth) * 1.5; // PDF base scale
            pdfState.scale = newScale;
            renderAllPdfPages();
        }
    } else {
        const containerWidth = docViewer.clientWidth - 40;
        const content = docViewer.querySelector('.docx-content, .epub-content');
        if (content) {
            const contentWidth = content.scrollWidth;
            const newScale = containerWidth / contentWidth;
            setZoomLevel(newScale);
        }
    }
    zoomState.fitMode = 'width';
}

function handleFitPage() {
    if (zoomState.currentDocumentType === 'pdf' && pdfState.pdfDoc) {
        const containerHeight = docViewer.clientHeight - 40;
        const firstPage = docViewer.querySelector('.page-container canvas');
        if (firstPage) {
            const pageHeight = firstPage.height / pdfState.scale;
            const newScale = (containerHeight / pageHeight) * 1.5; // PDF base scale
            pdfState.scale = newScale;
            renderAllPdfPages();
        }
    } else {
        const containerHeight = docViewer.clientHeight - 40;
        const content = docViewer.querySelector('.docx-content, .epub-content');
        if (content) {
            const contentHeight = content.scrollHeight;
            const newScale = containerHeight / contentHeight;
            setZoomLevel(newScale);
        }
    }
    zoomState.fitMode = 'page';
}

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case '=':
            case '+':
                e.preventDefault();
                handleZoomIn();
                break;
            case '-':
                e.preventDefault();
                handleZoomOut();
                break;
            case '0':
                e.preventDefault();
                handleZoomReset();
                break;
            case 'c':
                if (selectionState.isSelecting) {
                    e.preventDefault();
                    const selectedText = window.getSelection().toString().trim();
                    if (selectedText) {
                        navigator.clipboard.writeText(selectedText).then(() => {
                            showToast('Text copied to clipboard!');
                        });
                    }
                }
                break;
            case 't':
                if (selectionState.isSelecting) {
                    e.preventDefault();
                    const selectedText = window.getSelection().toString().trim();
                    if (selectedText) {
                        getTranslation(selectedText);
                    }
                }
                break;
        }
    }
    
    // Selection mode shortcuts
    if (e.altKey) {
        switch (e.key) {
            case 'w':
                e.preventDefault();
                selectionState.selectionMode = 'word';
                showToast('Selection mode: Word');
                break;
            case 's':
                e.preventDefault();
                selectionState.selectionMode = 'sentence';
                showToast('Selection mode: Sentence');
                break;
            case 'p':
                e.preventDefault();
                selectionState.selectionMode = 'paragraph';
                showToast('Selection mode: Paragraph');
                break;
            case 'a':
                e.preventDefault();
                selectionState.selectionMode = 'auto';
                showToast('Selection mode: Auto');
                break;
        }
    }
}

function handleWheelZoom(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(zoomState.minScale, Math.min(zoomState.maxScale, zoomState.scale + delta));
        setZoomLevel(newScale);
        zoomState.fitMode = 'none';
    }
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleGoToPage() {
    if (!pdfState.pdfDoc) return;
    const pageNum = parseInt(pageNumInput.value, 10);
    if (pageNum >= 1 && pageNum <= pdfState.numPages) {
        document.querySelector(`.page-container[data-page-number="${pageNum}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        showToast(`Invalid page number. Please enter a number between 1 and ${pdfState.numPages}.`);
    }
}

// --- FILE RENDERING ---
async function renderAllPdfPages() {
    docViewer.innerHTML = '<div class="loader"></div>';
    updateZoomControls();
    try {
        const pagesToRender = [];
        for (let i = 1; i <= pdfState.numPages; i++) {
            pagesToRender.push(pdfState.pdfDoc.getPage(i));
        }
        
        const pages = await Promise.all(pagesToRender);
        docViewer.innerHTML = ''; // Clear loader
        
        for (const page of pages) {
            const viewport = page.getViewport({ scale: pdfState.scale });
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.dataset.pageNumber = page.pageNumber;
            pageContainer.style.width = `${viewport.width}px`;
            pageContainer.style.height = `${viewport.height}px`;

            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            pageContainer.appendChild(canvas);
            
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            pageContainer.appendChild(textLayerDiv);
            
            docViewer.appendChild(pageContainer);

            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const textContent = await page.getTextContent();
            pdfjsLib.renderTextLayer({ textContent, container: textLayerDiv, viewport, textDivs: [] });
        }
    } catch(error) {
        const errorMessage = sanitizeHTML(error.message || 'Unknown error occurred');
        docViewer.innerHTML = `<div class="placeholder"><i class="fa-solid fa-file-circle-exclamation"></i><p>Error rendering PDF: ${errorMessage}</p></div>`;
        console.error("PDF Rendering Error:", error);
    }
}

async function renderPdf(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const typedarray = new Uint8Array(e.target.result);
            pdfState.pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
            pdfState.numPages = pdfState.pdfDoc.numPages;
            pdfState.scale = 1.5; // Reset scale for new book

            // Initialize zoom state for PDF
            zoomState.currentDocumentType = 'pdf';
            zoomState.scale = 1.0;
            zoomState.fitMode = 'none';

            // Show Document Controls
            documentControls.classList.remove('hidden');
            pageNavContainer.classList.remove('hidden');
            pageCountSpan.textContent = `/ ${pdfState.numPages}`;
            pageNumInput.max = pdfState.numPages;
            pageNumInput.value = 1;
            
            updateZoomControls();
            await renderAllPdfPages();

        } catch(error) {
            const errorMessage = sanitizeHTML(error.message || 'Unknown error occurred');
            docViewer.innerHTML = `<div class="placeholder"><i class="fa-solid fa-file-circle-exclamation"></i><p>Error loading PDF: ${errorMessage}</p></div>`;
            console.error("PDF Loading Error:", error);
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderDocx(file) {
    // Initialize zoom state for DOCX
    zoomState.currentDocumentType = 'docx';
    zoomState.scale = 1.0;
    zoomState.fitMode = 'none';

    // Show Document Controls (hide page navigation for non-PDFs)
    documentControls.classList.remove('hidden');
    pageNavContainer.classList.add('hidden');
    
    updateZoomControls();
    
    // Render DOCX with zoomable wrapper
    docViewer.innerHTML = '<div class="docx-content"></div>';
    const docxContainer = docViewer.querySelector('.docx-content');
    docx.renderAsync(file, docxContainer);
}

async function renderEpub(file) {
    // Initialize zoom state for EPUB
    zoomState.currentDocumentType = 'epub';
    zoomState.scale = 1.0;
    zoomState.fitMode = 'none';

    // Show Document Controls (hide page navigation for non-PDFs)
    documentControls.classList.remove('hidden');
    pageNavContainer.classList.add('hidden');
    
    updateZoomControls();
    
    // Render EPUB with zoomable wrapper
    docViewer.innerHTML = '<div class="epub-content"></div>';
    const epubContainer = docViewer.querySelector('.epub-content');
    const book = ePub(file);
    epubRendition = book.renderTo(epubContainer, { width: "100%", height: "100%" });
    
    epubRendition.display();
    epubRendition.on("selected", (cfiRange) => {
        const selectedText = epubRendition.getRange(cfiRange).toString().trim();
        if (selectedText.length > 2) {
            window.getSelection().empty();
            getTranslation(selectedText);
        }
    });
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = sanitizeHTML(message);
    container.appendChild(toast);
    
    // Clean up toast after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// --- ERROR HANDLING AND MEMORY MANAGEMENT ---
function cleanupResources() {
    // Clean up PDF resources
    if (pdfState.pdfDoc) {
        pdfState.pdfDoc.destroy?.();
        pdfState.pdfDoc = null;
    }
    
    // Clean up EPUB resources
    if (epubRendition) {
        epubRendition.destroy?.();
        epubRendition = null;
    }
    
    // Clean up Split.js instance
    if (splitInstance) {
        splitInstance.destroy?.();
        splitInstance = null;
    }
    
    // Clear translation log to prevent memory buildup
    translationLog = [];
    
    // Reset zoom state
    zoomState.currentDocumentType = null;
    zoomState.scale = 1.0;
    zoomState.fitMode = 'none';
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanupResources);

// Add error boundary for unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    showToast('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred. Please try again.');
});