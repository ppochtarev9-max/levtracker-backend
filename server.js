const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.send("Minimal server is running!");
});

app.post('/alice', (req, res) => {
    res.json({
        response: { text: 'Minimal server response!' },
        version: req.body.version || '1.0'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Minimal server running on port ${PORT}`));