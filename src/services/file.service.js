const fs = require('fs');
const path = require('path');

/**
 * Safely delete a local file based on its URL/path
 * @param {string} url - The URL or relative path of the file (e.g., /uploads/123.jpg)
 */
function deleteLocalFile(url) {
    if (!url) return;

    // Only handle local uploads
    if (url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '../../public', url);
        
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                // File does not exist, which is fine
                return;
            }

            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file: ${filePath}`, err);
                } else {
                    console.log(`Deleted unused file: ${filePath}`);
                }
            });
        });
    }
}

module.exports = {
    deleteLocalFile
};
