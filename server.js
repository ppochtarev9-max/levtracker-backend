require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const passport = require('passport');
const YandexStrategy = require('passport-yandex').Strategy;

const app = express();

// Middleware
app.use(express.json());
app.use(session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Database
const db = new sqlite3.Database(':memory:'); // Для теста, можно заменить на файл
db.serialize(() => {
    db.run(`CREATE TABLE records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        type TEXT,
        note TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Passport
passport.use(new YandexStrategy({
    clientID: '0aae8c1118434ea0a8d3fe04eca3d5ac', // Твой ID
    clientSecret: 'your-yandex-client-secret',
    callbackURL: "/auth/yandex/callback"
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    done(null, { id: id });
});

// Routes
app.get('/', (req, res) => {
    res.send('<a href="/login">Войти через Яндекс</a>');
});

app.get('/login', passport.authenticate('yandex'));

app.get('/auth/yandex/callback',
    passport.authenticate('yandex', { failureRedirect: '/' }),
    (req, res) => {
        // Перенаправляем на фронтенд с токеном
        res.redirect(`/login-success?token=${req.user.id}`);
    });

app.get('/login-success', (req, res) => {
    const token = req.query.token;
    res.send(`
        <html>
        <body>
            <h2>Вход успешен!</h2>
            <p>Токен: ${token}</p>
            <p>Теперь закройте браузер и откройте приложение.</p>
        </body>
        </html>
    `);
});

// API для получения записей
app.get('/api/records/:userId', (req, res) => {
    const userId = req.params.userId;
    db.all(`SELECT * FROM records WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));