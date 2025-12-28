import { Boom } from '@hapi/boom';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

async function connectToWhatsApp() {
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Utilisation de WA v${version.join('.')}`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info'); // Dossier pour stocker la session

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Affiche le QR dans les logs (pratique sur Render)
        auth: state,
        // Option pairing code (plus pratique que QR) : décommente si tu veux
        // getMessage: async (key) => { return { conversation: 'hello' } } // Optionnel
    });

    // Sauvegarde la session à chaque mise à jour
    sock.ev.on('creds.update', saveCreds);

    // Gestion reconnexion auto
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connexion fermée', lastDisconnect?.error, 'Reconnexion ?', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Bot connecté avec succès !');
        }
        if (update.qr) {
            qrcode.generate(update.qr, { small: true });
            console.log('Scannez ce QR avec WhatsApp > Appareils liés');
        }
    });

    // Exemple simple : répondre "Pong !" à tout message contenant "ping"
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (text.toLowerCase().includes('ping')) {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Pong ! 🏓' });
        }
    });
}

connectToWhatsApp();
