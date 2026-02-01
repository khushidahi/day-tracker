const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ============================================
// Database Setup (Turso for cloud, JSON for local)
// ============================================

const USE_DATABASE = process.env.TURSO_DATABASE_URL ? true : false;
let db = null;

async function initDatabase() {
    if (!USE_DATABASE) {
        console.log('📁 Using local JSON file storage');
        // Ensure data directory exists for local storage
        const DATA_DIR = path.join(__dirname, 'data');
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        return;
    }
    
    console.log('🗄️  Connecting to Turso database...');
    const { createClient } = require('@libsql/client');
    
    db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });
    
    // Create table if not exists
    await db.execute(`
        CREATE TABLE IF NOT EXISTS days (
            date TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            last_modified TEXT
        )
    `);
    
    console.log('✅ Database connected!');
}

// ============================================
// Data Access Functions
// ============================================

const DATA_DIR = path.join(__dirname, 'data');

function getFilename(date) {
    return path.join(DATA_DIR, `${date}.json`);
}

async function getDayData(date) {
    if (USE_DATABASE) {
        const result = await db.execute({
            sql: 'SELECT data FROM days WHERE date = ?',
            args: [date]
        });
        if (result.rows.length > 0) {
            return JSON.parse(result.rows[0].data);
        }
        return { timeBlocks: [], dayPlan: [], customCategories: [] };
    } else {
        const filename = getFilename(date);
        if (fs.existsSync(filename)) {
            try {
                return JSON.parse(fs.readFileSync(filename, 'utf8'));
            } catch (err) {
                console.error(`Error reading ${filename}:`, err);
                return { timeBlocks: [], dayPlan: [], customCategories: [] };
            }
        }
        return { timeBlocks: [], dayPlan: [], customCategories: [] };
    }
}

async function saveDayData(date, data) {
    const dataWithTimestamp = {
        ...data,
        lastModified: new Date().toISOString()
    };
    
    if (USE_DATABASE) {
        await db.execute({
            sql: `INSERT OR REPLACE INTO days (date, data, last_modified) VALUES (?, ?, ?)`,
            args: [date, JSON.stringify(dataWithTimestamp), dataWithTimestamp.lastModified]
        });
    } else {
        const filename = getFilename(date);
        fs.writeFileSync(filename, JSON.stringify(dataWithTimestamp, null, 2));
    }
    
    return dataWithTimestamp;
}

async function getAllDays() {
    if (USE_DATABASE) {
        const result = await db.execute('SELECT date, data FROM days ORDER BY date DESC');
        return result.rows.map(row => {
            const data = JSON.parse(row.data);
            const totalMinutes = (data.timeBlocks || []).reduce((sum, tb) => {
                return sum + (tb.endBlock - tb.startBlock + 1) * 5;
            }, 0);
            return {
                date: row.date,
                blockCount: (data.timeBlocks || []).length,
                totalMinutes,
                lastModified: data.lastModified
            };
        });
    } else {
        try {
            const files = fs.readdirSync(DATA_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => f.replace('.json', ''))
                .sort((a, b) => b.localeCompare(a));
            
            return files.map(date => {
                const filename = getFilename(date);
                try {
                    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
                    const totalMinutes = (data.timeBlocks || []).reduce((sum, tb) => {
                        return sum + (tb.endBlock - tb.startBlock + 1) * 5;
                    }, 0);
                    return {
                        date,
                        blockCount: (data.timeBlocks || []).length,
                        totalMinutes,
                        lastModified: data.lastModified
                    };
                } catch (err) {
                    return { date, blockCount: 0, totalMinutes: 0 };
                }
            });
        } catch (err) {
            console.error('Error listing days:', err);
            return [];
        }
    }
}

async function deleteDay(date) {
    if (USE_DATABASE) {
        await db.execute({
            sql: 'DELETE FROM days WHERE date = ?',
            args: [date]
        });
    } else {
        const filename = getFilename(date);
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
    }
}

// ============================================
// API Routes
// ============================================

// API: Get data for a specific date
app.get('/api/day/:date', async (req, res) => {
    try {
        const data = await getDayData(req.params.date);
        res.json(data);
    } catch (err) {
        console.error('Error getting day data:', err);
        res.json({ timeBlocks: [], dayPlan: [], customCategories: [] });
    }
});

// API: Save data for a specific date
app.post('/api/day/:date', async (req, res) => {
    try {
        await saveDayData(req.params.date, req.body);
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving day data:', err);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// API: Get list of all days with data
app.get('/api/days', async (req, res) => {
    try {
        const days = await getAllDays();
        res.json(days);
    } catch (err) {
        console.error('Error listing days:', err);
        res.json([]);
    }
});

// API: Delete a day's data
app.delete('/api/day/:date', async (req, res) => {
    try {
        await deleteDay(req.params.date);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting day:', err);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve day view for any date
app.get('/day/:date', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// Start Server
// ============================================

function getLocalIP() {
    try {
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
    } catch (e) {}
    return 'localhost';
}

async function start() {
    await initDatabase();
    
    const HOST = '0.0.0.0';
    const localIP = getLocalIP();
    
    app.listen(PORT, HOST, () => {
        if (USE_DATABASE) {
            console.log(`
╔════════════════════════════════════════════════════════╗
║                    DAY TRACKER                         ║
║                                                        ║
║   🌐 Running on port ${PORT}                              ║
║   📦 Using Turso cloud database                        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
            `);
        } else {
            console.log(`
╔════════════════════════════════════════════════════════╗
║                    DAY TRACKER                         ║
║                                                        ║
║   Local:   http://localhost:${PORT}                       ║
║   Network: http://${localIP}:${PORT}                    
║                                                        ║
║   📱 Access from your phone using the Network URL      ║
║   (Make sure you're on the same WiFi network)          ║
║                                                        ║
║   📁 Data stored locally in ./data                     ║
║   Press Ctrl+C to stop                                 ║
╚════════════════════════════════════════════════════════╝
            `);
        }
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
