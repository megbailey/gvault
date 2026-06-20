/*
 * https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
*/
const fileInput = document.querySelector('input[type="file"]');
if ( fileInput ) {
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        // Send files to background
        chrome.runtime.sendMessage({ type: 'UPLOAD_FILES', files, options: { readAs: 'dataURL', saveToStorage: true } }, (resp) => {
            console.log('Background response', resp);
        });
    });
}