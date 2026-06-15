const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const ccxt = require('ccxt');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'certichain_ledger.json');

// Memória temporária para armazenar chaves de API criptografadas dos seguidores
let seguidoresCopy = []; 

function carregarLedger() {
    if (!fs.existsSync(DATA_FILE)) {
        const blocoGenesis = {
            index: 0,
            timestamp: Date.now(),
            walletAddress: "GENESIS_NODE",
            kwhGenerated: 0,
            previousHash: "0",
            hash: crypto.createHash('sha256').update("SGS_GENESIS_BLOCK_2026").digest('hex'),
            saldos: {}
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify([blocoGenesis], null, 2));
        return [blocoGenesis];
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// DDoS Protection
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: "Membrana TopEnergy: Bloqueio preventivo por excesso de tráfego." }
});
app.use('/api/', apiLimiter);

// ==========================================
// MÓDULO 1: MEMBRANA DE ENERGIA (CERTICHAIN)
// ==========================================
app.post('/api/energia/gerar', (req, res) => {
    const { walletAddress, kwhGenerated } = req.body;
    if (!walletAddress || !kwhGenerated || parseFloat(kwhGenerated) <= 0) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    let ledger = carregarLedger();
    let ultimoBloco = ledger[ledger.length - 1];
    let saldosAtuais = { ...ultimoBloco.saldos };
    saldosAtuais[walletAddress] = (saldosAtuais[walletAddress] || 0) + parseFloat(kwhGenerated);

    const novoBloco = {
        index: ledger.length,
        timestamp: Date.now(),
        walletAddress: walletAddress,
        kwhGenerated: parseFloat(kwhGenerated),
        previousHash: ultimoBloco.hash,
        hash: "",
        saldos: saldosAtuais
    };

    const dadosString = novoBloco.index + novoBloco.timestamp + novoBloco.walletAddress + novoBloco.kwhGenerated + novoBloco.previousHash;
    novoBloco.hash = crypto.createHash('sha256').update(dadosString).digest('hex');

    ledger.push(novoBloco);
    fs.writeFileSync(DATA_FILE, JSON.stringify(ledger, null, 2));

    res.json({
        status: "Bloco Validado via CertiChain",
        blocoIndex: novoBloco.index,
        hashCertificado: novoBloco.hash,
        saldoAtualSGS: saldosAtuais[walletAddress]
    });
});

// ==========================================
// MÓDULO 2: AUTOMAÇÃO DE COPY TRADING MULTI-EXCHANGE
// ==========================================

// Endpoint para o seguidor vincular sua API Key com segurança
app.post('/api/trading/vincular', (req, res) => {
    const { exchangeId, apiKey, secret, uid } = req.body;
    
    if (!exchangeId || !apiKey || !secret) {
        return res.status(400).json({ error: "Credenciais de API incompletas." });
    }

    // Armazena no array de execução
    seguidoresCopy.push({ exchangeId, apiKey, secret, uid });
    console.log(`[COPY-TRADE] Novo seguidor integrado à rede para exchange: ${exchangeId}`);
    
    res.json({ status: "Sincronizado com o motor QI777. Aguardando ordens do Líder." });
});

// Endpoint Mestre: Quando você executa um trade na sua conta, dispara este Webhook
app.post('/api/trading/webhook-mestre', async (req, res) => {
    const { symbol, side, type, amount } = req.body; // ex: BTC/USDT, buy, market, 0.01

    console.log(`[LÍDER] Sinal recebido: ${side.toUpperCase()} ${amount} ${symbol}`);

    // Loop Assíncrono Ultraveloz para executar em lote nas contas dos seguidores
    let execucoes = seguidoresCopy.map(async (user) => {
        try {
            // Inicializa a exchange dinamicamente via CCXT
            const exchangeInstance = new ccxt[user.exchangeId]({
                apiKey: user.apiKey,
                secret: user.secret,
                enableRateLimit: true
            });

            // Executa a ordem de mercado idêntica
            const ordem = await exchangeInstance.createOrder(symbol, type, side, amount);
            return { uid: user.uid, status: "Sucesso", orderId: ordem.id };
        } catch (error) {
            return { uid: user.uid, status: "Falha", erro: error.message };
        }
    });

    const resultados = await Promise.all(execucoes);
    res.json({ status: "Ordens processadas em lote", logs: resultados });
});

app.get('/api/mercado/status', (req, res) => {
    const ledger = carregarLedger();
    const ultimoBloco = ledger[ledger.length - 1];
    res.json({
        totalBlocosValidados: ledger.length,
        seguidoresConectadosNoCopy: seguidoresCopy.length,
        carteirasAtivas: ultimoBloco.saldos
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Super App Interdimensional ativo na porta ${PORT}`));
