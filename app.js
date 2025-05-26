const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

const PORT = 3000;
const BASE_DIR = path.join(__dirname, 'file_storage');

// Ensure BASE_DIR exists
(async () => {
    try {
        await fs.mkdir(BASE_DIR, { recursive: true });
    } catch (err) {
        console.error(`Error creating base directory: ${err.message}`);
        process.exit(1);
    }
})();

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.searchParams;

    const sanitizeAndResolvePath = (userPath) => {
        if (!userPath) return null;
        const normalizedUserPath = path
            .normalize(userPath)
            .replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.join(BASE_DIR, normalizedUserPath);

        return fullPath.startsWith(BASE_DIR) ? fullPath : null;
    };

    try {
        if (pathname === '/' || pathname === '/list') {
            const files = await fs.readdir(BASE_DIR, { withFileTypes: true });
            res.writeHead(200, { 'Content-Type': 'text/html' });

            let html = `
                <h1>File Manager</h1>
                <h2>Files:</h2>
                <ul>
            `;
            files.forEach(file => {
                const fileName = file.name;
                html += `
                    <li>
                        ${fileName} ${file.isDirectory() ? '(Dir)' : '(File)'}
                        | <a href="/read?file=${encodeURIComponent(fileName)}">Read</a>
                        | <a href="/delete?file=${encodeURIComponent(fileName)}">Delete</a>
                    </li>
                `;
            });
            html += '</ul>';
            html += `
                <h2>Create File</h2>
                <form action="/create" method="GET">
                    <input type="text" name="file" placeholder="filename.txt" required>
                    <textarea name="content" placeholder="File content..."></textarea>
                    <button type="submit">Create File</button>
                </form>
            `;
            res.end(html);

        } else if (pathname === '/create' && req.method === 'GET') {
            const fileName = query.get('file');
            const content = query.get('content') || '';

            if (!fileName) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Bad Request: Missing filename.');
            }

            const filePath = sanitizeAndResolvePath(fileName);
            if (!filePath) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                return res.end('Forbidden: Invalid file path or name.');
            }

            await fs.writeFile(filePath, content);
            res.writeHead(302, { 'Location': '/' });
            res.end();

        } else if (pathname === '/read' && req.method === 'GET') {
            const fileName = query.get('file');
            if (!fileName) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Bad Request: Missing filename.');
            }

            const filePath = sanitizeAndResolvePath(fileName);
            if (!filePath) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                return res.end('Forbidden: Invalid file path or name.');
            }

            try {
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    return res.end('Cannot read a directory.');
                }
                const data = await fs.readFile(filePath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(data);
            } catch (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found.');
                } else {
                    throw err;
                }
            }
        } else if (pathname === '/delete' && req.method === 'GET') {
            const fileName = query.get('file');
            if (!fileName) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Bad Request: Missing filename.');
            }

            const filePath = sanitizeAndResolvePath(fileName);
            if (!filePath) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                return res.end('Forbidden: Invalid file path or name.');
            }

            try {
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    return res.end('Cannot delete a directory.');
                }
                await fs.unlink(filePath);
                res.writeHead(302, { 'Location': '/' });
                res.end();
            } catch (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found.');
                } else {
                    throw err;
                }
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found.');
        }

    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${error.message}`);
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});