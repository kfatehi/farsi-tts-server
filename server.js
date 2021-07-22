const express = require('express');
const app = express();
const crypto = require('crypto');
const fs = require('fs');
const generate = require('./generate')();

let audioDir = __dirname+"/audio";
app.use('/audio', express.static(audioDir));

app.use(express.json());

app.use('/', express.static('public'));

let busy = false;
app.post('/tts', async function (req, res) {
    if (req.body && req.body.content && req.body.content.length > 0) {
        let hash = crypto.createHash('md5').update(req.body.content).digest("hex");
        let filename = `${hash}.aac`;
        let filepath = audioDir+"/"+filename;
        if (!fs.existsSync(filepath)) {
            if (busy){
                return res.status(401).json({ error: "try again later" });        
            }
            busy = true
            await generate(req.body.content, filepath);
            busy = false;
        }
        return res.json({ path: `/audio/${filename}` });
    } else {
        res.status(401).json({ error: "something went wrong" });
    }
});

app.listen(3000, () => {
    console.log("listening on 3000");
});

