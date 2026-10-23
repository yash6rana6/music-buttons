const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3412;
const PUBLIC_DIR = __dirname;
const CATEGORIES_FILE = path.join(PUBLIC_DIR, 'categories.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Ensure categories.json exists
function loadCategoriesFromFile() {
    try {
        if (fs.existsSync(CATEGORIES_FILE)) {
            const data = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading categories.json:', e);
    }
    return {};
}

function saveCategoriesToFile(data) {
    try {
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error saving categories.json:', e);
        return false;
    }
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const reqUrl = req.url.split('?')[0];

    // GET /api/categories
    if (req.method === 'GET' && reqUrl === '/api/categories') {
        const categories = loadCategoriesFromFile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(categories));
        return;
    }

    // POST /api/categories (Save/Update Categories)
    if (req.method === 'POST' && reqUrl === '/api/categories') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                saveCategoriesToFile(parsed);
                console.log('[Server] Saved updated categories to categories.json');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, categories: parsed }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON data' }));
            }
        });
        return;
    }

    // POST /api/categories/delete (Delete a category pad)
    if (req.method === 'POST' && reqUrl === '/api/categories/delete') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { id } = JSON.parse(body);
                const categories = loadCategoriesFromFile();
                if (id && categories[id]) {
                    if (categories[id].isFixed) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Cannot delete fixed classic category' }));
                        return;
                    }
                    delete categories[id];
                    saveCategoriesToFile(categories);
                    console.log(`[Server] Permanently deleted category '${id}' from categories.json`);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, categories: categories }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid delete request' }));
            }
        });
        return;
    }

    // POST /api/upload (Save audio file to disk)
    if (req.method === 'POST' && reqUrl === '/api/upload') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { filename, data, folder } = JSON.parse(body);
                if (!filename || !data) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing filename or data' }));
                    return;
                }

                const targetFolder = (folder && ['memes', 'happy', 'laugh', 'crying', 'angry'].includes(folder))
                    ? folder
                    : 'memes';

                const targetDir = path.join(PUBLIC_DIR, 'sounds', targetFolder);

                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
                const filePath = path.join(targetDir, safeFilename);

                const base64Data = data.replace(/^data:audio\/[a-z0-9]+;base64,/, '').replace(/^data:application\/[a-z0-9]+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                fs.writeFileSync(filePath, buffer);
                const relativePath = `sounds/${targetFolder}/${safeFilename}`;
                console.log(`[Upload] Saved sound file to disk: ${relativePath}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    relativePath: relativePath,
                    filename: safeFilename
                }));

            } catch (err) {
                console.error('[Upload Error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to save file on server' }));
            }
        });
        return;
    }

    // Static File Server
    let fileReqUrl = req.url.split('?')[0];
    if (fileReqUrl === '/') fileReqUrl = '/index.html';

    const safePath = path.normalize(fileReqUrl).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

let currentPort = PORT;

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`\n[Notice] Port ${currentPort} is busy. Trying port ${currentPort + 1}...`);
        currentPort++;
        setTimeout(() => {
            server.listen(currentPort);
        }, 300);
    } else {
        console.error('Server error:', err);
    }
});

server.listen(currentPort, () => {
    console.log(`\n==================================================`);
    console.log(` Studio Soundboard Server running at:`);
    console.log(` http://localhost:${currentPort}`);
    console.log(` Persistent Storage: categories.json`);
    console.log(`==================================================\n`);
});
