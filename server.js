const express = require('express');
const { createWorker } = require('tesseract.js');

const app = express();
app.use(express.json({ limit: '15mb' }));

app.use(express.static('public'));

let chatMessages = [
    { name: "🤖 AI ASSISTANT", message: "Manao manao! Alefaso ny Capture, dia ny AI no hamaky azy raha marina ny anarana Ezekia Stefan sy ny laharana admin.", time: new Date() }
];

let users = {
    '0387680298': { pseudo: 'Ezekia Stefan (Admin)', solde: 5000000, role: 'admin', age: 30 }
};

let retraits = []; 
let history = [1.50, 2.10, 1.15, 3.40, 1.80];
let usedSmsSet = new Set();

let gameState = {
    status: 'WAITING',
    multiplier: 1.00,
    crashPoint: 1.00,
    timer: 5
};

function runGameEngine() {
    gameState.status = 'WAITING';
    gameState.multiplier = 1.00;
    gameState.timer = 5;

    let countdown = setInterval(() => {
        gameState.timer--;
        if (gameState.timer <= 0) {
            clearInterval(countdown);
            startGameRound();
        }
    }, 1000);
}

function startGameRound() {
    gameState.status = 'RUNNING';
    gameState.crashPoint = (Math.random() * 4 + 1.1).toFixed(2);

    let gameLoop = setInterval(() => {
        gameState.multiplier = (parseFloat(gameState.multiplier) + 0.03).toFixed(2);

        if (parseFloat(gameState.multiplier) >= parseFloat(gameState.crashPoint)) {
            clearInterval(gameLoop);
            gameState.status = 'CRASHED';
            history.unshift(parseFloat(gameState.crashPoint));
            if (history.length > 10) history.pop();

            setTimeout(() => {
                runGameEngine();
            }, 3000);
        }
    }, 100);
}

runGameEngine();

app.get('/api/game-state', (req, res) => {
    res.json({ gameState, history });
});

app.post('/api/auth', (req, res) => {
    const { phone, pseudo, age } = req.body;
    
    const phoneRegex = /^03[23478]\d{7}$/;
    if (!phoneRegex.test(phone)) {
        return res.json({ success: false, message: "Laharana finday tsy manara-penitra! (Ohatra: 0341234567)" });
    }

    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge < 18) {
        return res.json({ success: false, message: "Refusé! Tsy maintsy feno 18 taona no miakatra vao afaka milalao." });
    }

    if (!users[phone]) {
        users[phone] = { 
            pseudo: pseudo ? pseudo.trim() : `Mpilalao_${phone.slice(-4)}`, 
            solde: 0, 
            role: phone === '0387680298' ? 'admin' : 'player', 
            age: parsedAge 
        };
    } else {
        if (pseudo) users[phone].pseudo = pseudo.trim();
    }

    res.json({ success: true, user: users[phone] });
});

app.get('/api/user/:phone', (req, res) => {
    const phone = req.params.phone;
    if (!users[phone]) return res.status(404).json({ error: "User not found" });
    res.json(users[phone]);
});

app.post('/api/cashout', (req, res) => {
    const { phone, bet, multiplier } = req.body;
    if (!users[phone]) return res.status(400).json({ error: "User not found" });

    const winAmount = Math.floor(parseInt(bet) * parseFloat(multiplier));
    users[phone].solde += winAmount;

    res.json({ success: true, winAmount, newSolde: users[phone].solde });
});

app.post('/api/place-bet', (req, res) => {
    const { phone, bet } = req.body;
    if (!users[phone]) return res.json({ success: false, message: "User not found" });

    const parsedBet = parseInt(bet);
    if (users[phone].solde < parsedBet) {
        return res.json({ success: false, message: "Tsy ampy ny solde!" });
    }

    users[phone].solde -= parsedBet;
    res.json({ success: true, newSolde: users[phone].solde });
});

app.post('/api/retrait', (req, res) => {
    const { phone, amount, targetPhone } = req.body;
    const parsedAmount = parseInt(amount);

    if (!users[phone]) return res.json({ success: false, message: "Mpilalao tsy hita." });
    if (users[phone].solde < parsedAmount) {
        return res.json({ success: false, message: "Tsy ampy ny solde hanaovana retrait!" });
    }

    users[phone].solde -= parsedAmount;

    const retraitObj = {
        id: Date.now(),
        phone,
        pseudo: users[phone].pseudo,
        targetPhone,
        amount: parsedAmount,
        status: 'En attente',
        time: new Date()
    };

    retraits.push(retraitObj);
    res.json({ success: true, newSolde: users[phone].solde, message: "Fangatahana retrait nalefa! Efa voatsindry ao amin'ny solde-nao ny vola." });
});

app.get('/api/retraits/:phone', (req, res) => {
    const userRetraits = retraits.filter(r => r.phone === req.params.phone);
    res.json(userRetraits);
});

app.get('/api/admin/retraits', (req, res) => {
    res.json(retraits);
});

app.post('/api/admin/retrait-action', (req, res) => {
    const { retraitId, action } = req.body; 
    const retrait = retraits.find(r => r.id == retraitId);

    if (!retrait) return res.json({ success: false, message: "Tsy hita ilay fangatahana retrait." });
    if (retrait.status !== 'En attente') {
        return res.json({ success: false, message: "Efa voamarina sahady io fangatahana io!" });
    }

    retrait.status = action;
    if (action === 'Refusé' && users[retrait.phone]) {
        users[retrait.phone].solde += retrait.amount;
    }

    res.json({ success: true, message: `Voasoratra hoe: ${action}` });
});

app.post('/api/chat/send', (req, res) => {
    const { phone, message } = req.body;
    if (phone && message && users[phone]) {
        chatMessages.push({ name: users[phone].pseudo, message, time: new Date() });
        if (chatMessages.length > 50) chatMessages.shift();
    }
    res.json({ success: true });
});

app.post('/api/depot-ai-vision', async (req, res) => {
    const { phone, amount, imageBase64 } = req.body;
    if (!users[phone]) return res.json({ success: false, message: "User not found" });

    const parsedAmount = parseInt(amount);

    try {
        const worker = await createWorker('eng');
        const ret = await worker.recognize(imageBase64);
        await worker.terminate();

        const extractedText = ret.data.text.toLowerCase();
        let hasEzekia = extractedText.includes('ezekia') || extractedText.includes('stefan');
        let hasAdminNumber = extractedText.includes('0387680298');

        if (!hasEzekia || !hasAdminNumber) {
            chatMessages.push({
                name: "🤖 AI ASSISTANT",
                message: `🚨 Fausse capture naverina / Nolavina miaraka amin'ny fampitandremana ho an'ny mpandika lalàna (${users[phone].pseudo}).`,
                time: new Date()
            });

            if (chatMessages.length > 50) chatMessages.shift();

            return res.json({ 
                success: false, 
                isFausseCapture: true,
                message: "🚨 FAMPITANDREMANA! Nolavina ny sary satria fausse capture. Averina indray mandeha dia hosakanana ianao!" 
            });
        }

        if (usedSmsSet.has(imageBase64.substring(0, 100))) {
            return res.json({ success: false, message: "Efa nampiasaina io sary io teo aloha!" });
        }

        usedSmsSet.add(imageBase64.substring(0, 100));
        users[phone].solde += parsedAmount;

        chatMessages.push({
            name: "🤖 AI ASSISTANT",
            message: `🎉 DÉPÔT REÇU: Niditra soa aman-tsara ny +${parsedAmount} Ar ho an'i ${users[phone].pseudo}!`,
            time: new Date()
        });

        if (chatMessages.length > 50) chatMessages.shift();
        res.json({ success: true, newSolde: users[phone].solde, message: "Dépôt voamarina ho azy!" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Nisy olana tamin'ny famakiana ny sary!" });
    }
});

app.get('/api/chat', (req, res) => {
    res.json(chatMessages);
});

app.listen(3000, () => {
    console.log('Server mandeha tsara amin\'ny port 3000...');
});
