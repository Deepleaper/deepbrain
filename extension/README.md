# DeepBrain Chrome Extension

Save web pages and highlighted text to your DeepBrain knowledge base with one click.

## Features

- **Quick Save**: Click the extension icon to save the current page
- **Context Menu**: Highlight text → right-click → "Save to DeepBrain"
- **Auto-fill**: Title, slug, and content are auto-populated from the page
- **Configurable**: Set your DeepBrain API URL and brain name

## Install (Developer Mode)

1. Start the DeepBrain API server:
   ```bash
   deepbrain serve --port 3333
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right)

4. Click **Load unpacked** and select the `extension/` directory

5. The 🧠 icon appears in your toolbar — you're ready!

## Usage

### Quick Save (Popup)
1. Click the 🧠 icon in the toolbar
2. Adjust slug, title, type, or content if needed
3. Click **Save to Brain**

### Context Menu (Right-Click)
1. Highlight any text on a web page
2. Right-click → **🧠 Save to DeepBrain**
3. The selected text is saved as a bookmark with the page URL

### Settings
Click the ⚙️ Settings section in the popup to configure:
- **API URL**: Default `http://localhost:3333` (your DeepBrain serve endpoint)
- **Brain name**: Which brain to save to (default: `default`)

## Requirements

- DeepBrain server running (`deepbrain serve`)
- Chrome/Chromium-based browser (Edge, Brave, Arc, etc.)

## Icon Placeholders

Place your icons in `extension/icons/`:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

Or the extension will work without custom icons.
