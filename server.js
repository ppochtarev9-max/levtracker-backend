require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.send("Test server is running!");
});

app.post('/alice', (req, res) => {
    console.log("Alice request received:", JSON.stringify(req.body, null, 2));
    res.json({
        response: { text: 'Test response from server!' },
        version: req.body.version || '1.0'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Test server running on port ${PORT}`));