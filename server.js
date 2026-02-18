const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());

app.get('/', (req, res) => {
    console.log("GET / called");
    res.send("Minimal server is running!");
});

app.post('/alice', (req, res) => {
    console.log("POST /alice called");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    res.json({
        response: { text: 'Minimal server response!' },
        version: req.body.version || '1.0'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Minimal server running on port ${PORT}`));