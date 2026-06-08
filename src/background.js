// background.js (MV3 service worker style)
const CHANNEL = 'file-upload-channel';

// Helper: read a File/Blob as ArrayBuffer or text
function readFileAs(file, as = 'arrayBuffer') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
            reader.abort();
            reject(new Error('File read error'));
        };
        reader.onload = () => resolve(reader.result);
        if (as === 'arrayBuffer') reader.readAsArrayBuffer(file);
        else if (as === 'text') reader.readAsText(file);
        else if (as === 'dataURL') reader.readAsDataURL(file);
        else reject(new Error(`Unsupported read mode; ${as}`));
    });
}

// Process incoming file(s)
// options: { readAs: 'arrayBuffer'|'text'|'dataURL', saveToStorage: boolean }
async function handleFiles(files, options = {}) {
    const readAs = options.readAs || 'arrayBuffer';
    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const content = await readFileAs(file, readAs);
            const meta = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
            };
            results.push({ meta, content });
        } catch (err) {
        results.push({ error: err.message, name: file.name });
        }
  }

    if (options.saveToStorage) {
        // store metadata+small files only (be careful with large blobs)
        try {
            await chrome.storage.local.set({ lastUploadedFiles: results });
        } catch (e) {
            console.warn('Storage set failed', e);
        }
    }

    return results;
}

// Respond to messages from content scripts or extension UIs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Keep response channel open for async reply
    if (message && message.type === 'UPLOAD_FILES') {
        // Expect message.files to be an array of File-like objects (from content script)
        // and optional options
        const files = message.files || [];
        const options = message.options || { readAs: 'arrayBuffer' };

        // If files are transferred via structured clone they may appear as Blobs/Files
        handleFiles(files, options).then((results) => {
            sendResponse({ success: true, results });
        }).catch((err) => {
            sendResponse({ success: false, error: err.message });
        });

        return true; // indicates sendResponse will be called asynchronously
    }

    // Simple ping
    if (message && message.type === 'PING') {
        sendResponse({ pong: true, time: Date.now() });
        return false;
    }
});

// Optional: handle long-lived connections (chrome.runtime.connect)
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== CHANNEL) return;
    port.onMessage.addListener(async (msg) => {
        if (msg.type === 'UPLOAD_FILES') {
            try {
                const results = await handleFiles(msg.files || [], msg.options || {});
                port.postMessage({ success: true, results });
            } catch (err) {
                port.postMessage({ success: false, error: err.message });
            }
        }
    });
});
