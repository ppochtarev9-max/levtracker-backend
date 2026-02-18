require('dotenv').config();
const express = require('express');
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
        res.redirect(`levtracker://login-success?token=${req.user.id}`);
    });

// Обработка запроса от Алисы (без базы)
app.post('/alice', (req, res) => {
    console.log("Alice request received:", JSON.stringify(req.body, null, 2));

    try {
        // Безопасно получаем applicationId
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

        const command = req.body.request.original_utterance.toLowerCase();

        // Только логика, без базы
        if (command.includes('добавь сон')) {
            console.log(`Adding sleep record for user: ${userId}`);
        }

        if (command.includes('добавь бодрствование')) {
            console.log(`Adding awake record for user: ${userId}`);
        }

        if (command.includes('добавь кормление')) {
            console.log(`Adding feeding record for user: ${userId}`);
        }

        res.json({
            response: { text: 'Запись добавлена!' },
            version: req.body.version || '1.0'
        });
    } catch (error) {
        console.error("Error in /alice handler:", error);
        res.status(200).json({
            response: { text: "Произошла ошибка при обработке команды." },
            version: req.body.version || '1.0'
        });
    }
});

// Получение записей (заглушка)
app.get('/api/records/:userId', (req, res) => {
    res.json([]);
});

// Ручное добавление (заглушка)
app.post('/api/add-record', (req, res) => {
    res.status(200).json({ message: "Record added successfully" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));