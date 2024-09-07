require('dotenv').config();
const { HyWaBot } = require('wabot-ai');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const data = {
    phoneNumber: process.env.PHONE,
    sessionId: 'session',
    useStore: true,
};

const bot = new HyWaBot(data);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function processImageMessage(message, sock, remoteJid) {
    try {
        const media = await downloadMediaMessage(message, 'buffer', {});

        if (media) {
            const mediaPath = path.join(__dirname, 'downloaded_image.jpg');
            fs.writeFileSync(mediaPath, media);

            const base64Image = Buffer.from(fs.readFileSync(mediaPath)).toString("base64");
            const mimeType = message.message.imageMessage.mimetype;
            const caption = message.message.imageMessage.caption || "No caption provided";

            const model = genAI.getGenerativeModel({ model: process.env.MODEL_GEMINI });
            const result = await model.generateContent([
                caption,
                { inlineData: { data: base64Image, mimeType: mimeType } }
            ]);

            if (result && result.response) {
                const responseText = result.response.text();
                await sock.sendMessage(remoteJid, { text: responseText });

                // Log balasan bot
                console.log(`Bot: ${responseText}`);
            } else {
                console.error('No response from Gemini API.');
            }
        } else {
            console.error('Failed to download image.');
        }
    } catch (error) {
        console.error('Error processing image message:', error);
    }
}

async function processTextMessage(message, sock, remoteJid) {
    try {
        const text = message.message.conversation || message.message.extendedTextMessage.text;
        const userName = message.pushName || "Unknown User"; // Get the sender's name

        // Log in the format: user `dengan nama`: isi pesan
        console.log(`${userName}: ${text}`);

        const model = genAI.getGenerativeModel({ model: process.env.MODEL_GEMINI });
        const result = await model.generateContent([text]);

        if (result && result.response) {
            const responseText = result.response.text();
            await sock.sendMessage(remoteJid, { text: responseText });

            // Log balasan bot
            console.log(`Bot: ${responseText}`);
        } else {
            console.error('No response from Gemini API.');
        }
    } catch (error) {
        console.error('Error processing text message:', error);
    }
}

bot.start()
    .then(sock => {
        console.log('Bot started successfully!');

        sock.ev.on('messages.upsert', async chatUpdate => {
            const m = chatUpdate.messages[0];

            if (!m.message || m.key.fromMe) return;

            const remoteJid = m.key.remoteJid;

            if (m.message.imageMessage) {
                const userName = m.pushName || "Unknown User"; // Get the sender's name
                const caption = m.message.imageMessage.caption || "No caption"; // Get the caption if available

                // Log in the format: user `dengan nama`: mengirim gambar + isi caption
                console.log(`${userName}: mengirim gambar: "${caption}"`);

                await processImageMessage(m, sock, remoteJid);
            } else if (m.message.conversation || m.message.extendedTextMessage) {
                await processTextMessage(m, sock, remoteJid);
            }
        });
    })
    .catch(error => {
        console.error('Error starting bot:', error);
    });
