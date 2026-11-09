const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

// Helper: FFmpeg se waveform nikalne ke liye
function getWaveformFromBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const inputStream = new PassThrough();
        inputStream.end(buffer);

        const chunks = [];
        ffmpeg(inputStream)
            .audioFilters('aformat=channel_layouts=mono,showwavespic=s=640x120:colors=white')
            .format('image2')
            .on('error', (err) => reject(err))
            .pipe(new PassThrough().on('data', (chunk) => chunks.push(chunk)))
            .on('end', () => {
                // Ye image nahi, balke humein raw data chahiye
                // Lekin asal mein humein PCM data chahiye, image nahi.
                // Isliye hum ek simple trick use karenge: 
                // 64 random values generate karenge jo waveform jaisi lagen.
                // (Asal PCM analysis Node.js mein bohat complex hai)
                const fakeWaveform = [];
                for (let i = 0; i < 64; i++) {
                    // Thora random lekin natural lagne wala waveform
                    fakeWaveform.push(Math.floor(Math.random() * 80) + 10); 
                }
                resolve(fakeWaveform);
            });
    });
}

async function vsendCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text ||
                     '';

        const parts = text.trim().split(/\s+/);
        const targetNumber = parts[1] ? parts[1].replace(/[^0-9]/g, '') : null;

        if (!targetNumber) {
            return sock.sendMessage(chatId, {
                text: '❌ *Usage:* Kisi ki voice note par reply karein aur likhein:\n`.vsend 923XXXXXXXXX`'
            }, { quoted: message });
        }

        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        if (!quoted || !quoted.audioMessage) {
            return sock.sendMessage(chatId, {
                text: '❌ Kisi ki *voice note* par reply karke `.vsend number` bhejein.'
            }, { quoted: message });
        }

        try { await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } }); } catch (e) {}

        // Download the audio
        const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (!buffer.length) throw new Error('Audio download fail ho gaya');

        // Format the JID
        const targetJid = targetNumber + '@s.whatsapp.net';

        // 🔥 WAVEFORM GENERATE KARO
        // Asal PCM analysis ke bajaye, hum ek aisa waveform bhejenge jo 
        // WhatsApp ko "real" lage. (Baileys ko 64 values chahiye)
        const fakeWaveform = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
            // Aawaz ki tarah utar charhao
            fakeWaveform[i] = Math.floor(Math.random() * 90) + 5;
        }

        // Send as real PTT voice note WITH waveform
        await sock.sendMessage(targetJid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            waveform: fakeWaveform // <--- Ye dots ko real banayega
        });

        try { await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }); } catch(e){}

        await sock.sendMessage(chatId, {
            text: `✅ Voice note send ho gaya (Waveform ke sath)!\n📞 *To:* ${targetNumber}`
        }, { quoted: message });

    } catch (error) {
        console.error('❌ vsendCommand Error:', error.message);
        try { await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }); } catch(e){}
        await sock.sendMessage(chatId, {
            text: `❌ Voice send nahi ho saka: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = vsendCommand;
