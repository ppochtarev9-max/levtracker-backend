require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const YandexStrategy = require('passport-yandex').Strategy;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Сессия
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

// Инициализация БД
const db = new sqlite3.Database('./tracker.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        type TEXT,
        note TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_mapping (
        application_id TEXT PRIMARY KEY,
        user_token TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Настройка Passport для Яндекса
passport.use(new YandexStrategy({
    clientID: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET,
    callbackURL: "/auth/yandex/callback"
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

// Сериализация и десериализация
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    done(null, { id: id });
});

app.get('/', (req, res) => {
    res.send("LevTracker API is running!");
});

app.get('/auth/yandex', passport.authenticate('yandex'));

app.get('/auth/yandex/callback',
    passport.authenticate('yandex', { failureRedirect: '/' }),
    (req, res) => {
        // req.session.applicationId — если он был передан в сессии от Алисы
        const applicationId = req.session.applicationId || null;

        if (applicationId) {
            // Сопоставляем applicationId с userToken
            linkUserIds(applicationId, req.user.id);
        }

        res.redirect(`levtracker://login-success?token=${req.user.id}`);
    });

// Функция добавления записи
ffunction addRecord(userId, type, note) {
    console.log("addRecord called with userId:", userId, "type:", type, "note:", note);

    const currentTime = new Date().toISOString();

    if (type === 'сон' || type === 'бодрствование') {
        db.get(`
            SELECT * FROM records WHERE user_id = ? AND type != ? AND note LIKE 'начало%' 
            ORDER BY timestamp DESC LIMIT 1
        `, [userId, type], (err, row) => {
            if (err) {
                console.error("Database error in addRecord SELECT:", err);
                return;
            }

            console.log("Found previous record:", row);

            if (row && !row.note.includes('окончание')) {
                const endNote = row.type === 'сон' ? 'окончание сна' : 'окончание бодрствования';
                console.log("Inserting end record:", userId, row.type, endNote, currentTime);

                db.run(`INSERT INTO records (user_id, type, note, timestamp) VALUES (?, ?, ?, ?)`,
                    [userId, row.type, endNote, currentTime], (err) => {
                        if (err) {
                            console.error("Failed to insert end record:", err);
                        } else {
                            console.log("End record inserted successfully");
                        }
                    });
            }

            console.log("Inserting new record:", userId, type, note, currentTime);

            db.run(`INSERT INTO records (user_id, type, note, timestamp) VALUES (?, ?, ?, ?)`,
                [userId, type, note, currentTime], (err) => {
                    if (err) {
                        console.error("Failed to insert new record:", err);
                    } else {
                        console.log("New record inserted successfully");
                    }
                });
        });
    } else {
        console.log("Inserting feeding record:", userId, type, note, currentTime);

        db.run(`INSERT INTO records (user_id, type, note, timestamp) VALUES (?, ?, ?, ?)`,
            [userId, type, note, currentTime], (err) => {
                if (err) {
                    console.error("Failed to insert feeding record:", err);
                } else {
                    console.log("Feeding record inserted successfully");
                }
            });
    }
}
// Функция сопоставления пользователей
function linkUserIds(applicationId, userToken) {
    db.run(`
        INSERT OR REPLACE INTO user_mapping (application_id, user_token)
        VALUES (?, ?)
    `, [applicationId, userToken], (err) => {
        if (err) {
            console.error("Failed to link user IDs:", err);
        } else {
            console.log(`Linked application_id: ${applicationId} with user_token: ${userToken}`);
        }
    });
}

// Обработка запроса от Алисы
app.post('/alice', (req, res) => {
    console.log("Alice request received:", JSON.stringify(req.body, null, 2));

    try {
        const applicationId = req.body.session?.application?.application_id;
        const userId = req.body.session.user_id || applicationId;

        if (!userId) {
            console.error("No user ID found in request");
            console.log("Session object:", JSON.stringify(req.body.session, null, 2));
            return res.status(200).json({
                response: { text: "Не удалось получить ID пользователя." },
                version: req.body.version || '1.0'
            });
        }

        // Если пришёл applicationId, но нет user_id — ищем в таблице связей
        if (!req.body.session.user_id && applicationId) {
            db.get(
                `SELECT user_token FROM user_mapping WHERE application_id = ?`,
                [applicationId],
                (err, row) => {
                    if (err) {
                        console.error("Database error in Alice handler:", err);
                        return res.status(200).json({
                            response: { text: "Ошибка базы данных." },
                            version: req.body.version || '1.0'
                        });
                    }

                    const actualUserId = row ? row.user_token : applicationId;

                    // Добавляем запись под actualUserId
                    handleAliceRequest(actualUserId, req, res);
                }
            );
        } else {
            // Если user_id уже есть, используем его напрямую
            handleAliceRequest(userId, req, res);
        }
    } catch (error) {
        console.error("Error in /alice handler:", error);
        res.status(200).json({
            response: { text: "Произошла ошибка при обработке команды." },
            version: req.body.version || '1.0'
        });
    }
});

// Вынесенная логика обработки запроса от Алисы
function handleAliceRequest(userId, req, res) {
    const command = req.body.request.original_utterance.toLowerCase();

    if (command.includes('добавь сон')) {
        addRecord(userId, 'сон', 'начало сна');
    }

    if (command.includes('добавь бодрствование')) {
        addRecord(userId, 'бодрствование', 'начало бодрствования');
    }

    if (command.includes('добавь кормление')) {
        addRecord(userId, 'кормление', 'кормление');
    }

    res.json({
        response: { text: 'Запись добавлена!' },
        version: req.body.version || '1.0'
    });
}

// Получение записей пользователя
app.get('/api/records/:userId', (req, res) => {
    const userId = req.params.userId;
    db.all(`SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC`, [userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получение записей с фильтром
app.get('/api/records/:userId/filter', (req, res) => {
    const userId = req.params.userId;
    const { type, from, to } = req.query;

    let query = `SELECT * FROM records WHERE user_id = ?`;
    let params = [userId];

    if (type) {
        query += ` AND type = ?`;
        params.push(type);
    }

    if (from) {
        query += ` AND timestamp >= ?`;
        params.push(from);
    }

    if (to) {
        query += ` AND timestamp <= ?`;
        params.push(to);
    }

    query += ` ORDER BY timestamp DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Отчёт за период
app.get('/api/report/:userId/:from/:to', (req, res) => {
    const { userId, from, to } = req.params;
    db.all(`
        SELECT type, note, timestamp FROM records 
        WHERE user_id = ? AND timestamp BETWEEN ? AND ?
    `, [userId, from, to], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Ручное добавление записи (для iOS-приложения)
app.post('/api/add-record', (req, res) => {
    const { userId, type, note } = req.body;

    if (!userId || !type) {
        return res.status(400).json({ error: "Missing userId or type" });
    }

    const currentTime = new Date().toISOString();

    if (type === 'сон' || type === 'бодрствование') {
        db.get(`
            SELECT * FROM records WHERE user_id = ? AND type != ? AND note LIKE 'начало%' 
            ORDER BY timestamp DESC LIMIT 1
        `, [userId, type], (err, row) => {
            if (err) {
                console.error("Database error in manual addRecord:", err);
                return res.status(500).json({ error: err.message });
            }

            if (row && !row.note.includes('окончание')) {
                const endNote = row.type === 'сон' ? 'окончание сна' : 'окончание бодрствования';
                db.run(`INSERT INTO records (user_id, type, note, timestamp) VALUES (?, ?, ?, ?)`,
                    [userId, row.type, endNote, currentTime], (err) => {
                        if (err) console.error("Failed to insert end record:", err);
                    });
            }

            db.run(`INSERT INTO records (user_id, type, note, timestamp) VALUES (?, ?, ?, ?)`,
                [userId, type, note, currentTime], function(err) {
                    if (err) {
                        console.error("Failed to insert new record:", err);
                        res.status(500).json({ error: err.message });
                    } else {
                        res.status(200).json({ message: "Record added successfully", id: this.lastID });
                    }
                });
        });
    } else {
        db.run(`INSERT INTO records (user_id, type, note, timestamp) VALUES (?, ?, ?, ?)`,
            [userId, type, note, currentTime], function(err) {
                if (err) {
                    console.error("Failed to insert feeding record:", err);
                    res.status(500).json({ error: err.message });
                } else {
                    res.status(200).json({ message: "Record added successfully", id: this.lastID });
                }
            });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));