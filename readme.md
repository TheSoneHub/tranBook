# docutranslate-ai
### Core Features Implemented in V1

- [x]  **🚀 Welcome Screen** — A beautiful animated welcome screen to greet users and introduce the application's purpose.
- [x]  **📚 Local Document Library**
    - Users can upload multiple documents (`.pdf`).
    - Documents are saved locally in the browser's IndexedDB, creating a persistent personal library.
    - Users can open any book from their library without re-uploading.
    - Ability to delete books from the library.
- [x]  **📖 Integrated Document Viewer**
    - High-fidelity rendering for PDF (with selectable text layer), DOCX, and EPUB files.
    - Clean, distraction-free reading interface.
- [x]  **✨ AI-Powered "Select-to-Translate"**
    - The core feature: simply highlighting text in any document instantly triggers a translation.
    - Powered by Google's Gemini AI for natural and context-aware translations.
    - Supports multiple target languages (Burmese, English, Japanese).
- [x]  **📑 Translation Management**
    - A clean, tabbed interface to switch between the current translation and the session's history.
    - **Copy to Clipboard:** Easily copy the translated text with a single click.
    - **Export to Markdown:** Export the entire session's translation history as a `.md` file, perfect for note-taking in apps like Notion.
- [x]  **👓 Professional UI/UX**
    - **Resizable Panes:** Adjust the size of the reader and translator panels for a personalized workflow.
    - **Dark Mode:** A beautiful, eye-friendly dark theme that's saved to the user's preference.
    - **Elegant Design:** A modern, clean interface with a professional color palette, typography, and subtle animations.
    - **Toast Notifications:** Non-intrusive feedback for actions like copying text or exporting history.
- [x]  **📄 PDF Page Navigation**
    - A simple and effective "Go to Page" input box for PDFs, allowing users to jump directly to any page.

### Technical Stack & Architecture

- **Frontend:** Static Web App (HTML, CSS, JavaScript)
- **Core Libraries:**
    - `pdf.js` for PDF rendering
    - `docx-preview.js` for DOCX rendering
    - `Epub.js` for EPUB rendering
    - `Split.js` for resizable panes
- **Local Storage:** IndexedDB for the document library
- **AI Backend:** Google Gemini API
- **API Key Security:** The final version uses a local `config.js` file (ignored by Git) to store the API key, ensuring it is not exposed in public repositories

### Final Decision: Feature Removals for Stability

- Removed **Table of Contents (TOC)** due to instability across document types and UI clutter. Kept the reliable **Go to Page** feature for PDFs to maintain stability and clarity.


### Open Issues

- Fonts
- Zoom in / zoom out
- page content

---

## API Key Management (v1.1)

The app now uses a dedicated **Settings modal** for managing your Google AI Studio API key:

1. Click the **Settings** button (gear icon) in the app header.
2. Enter your Google AI Studio API key in the input box.
3. Click **Save API Key**. The key will be stored securely in your browser's localStorage.
4. The app will use this key for translation requests.
5. You can update or remove the key at any time via the settings modal.

Your API key is never exposed in the UI and is not stored on any server.