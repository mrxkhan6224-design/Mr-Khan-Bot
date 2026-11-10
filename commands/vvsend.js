const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function vvsendCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text ||
                     '';

        const parts = text.trim().split(/\s+/);
        const targetNumber = parts[1] ? parts[1].replace(/[^0-9]/g, '') : null;

        if (!targetNumber) {
            return sock.sendMessage(chatId, {
                text: '❌ *Usage:* Kisi voice note par reply karein aur likhein:\n`.vvsend 923XXXXXXXXX`'
            }, { quoted: message });
        }

        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        if (!quoted || !quoted.audioMessage) {
            return sock.sendMessage(chatId, {
                text: '❌ Kisi ki *voice note* par reply karke `.vvsend number` bhejein.'
            }, { quoted: message });
        }

        try { await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } }); } catch (e) {}

        // Download the audio
        const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (!buffer.length) throw new Error('Audio download fail ho gaya');

        const targetJid = targetNumber + '@s.whatsapp.net';

        // ✅ FIX: Direct audioMessage with viewOnce: true
        // Kuch Baileys versions mein ye direct flag kaam karta hai
        await sock.sendMessage(targetJid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            viewOnce: true // Ye flag view-once banane ki koshish karega
        });

        try { await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } }); } catch(e){}

        await sock.sendMessage(chatId, {
            text: `✅ *View-Once Voice* try kiya gaya!\n📞 *To:* ${targetNumber}`
        }, { quoted: message });

        console.log(`✅ View-Once Voice attempted to ${targetNumber}`);

    } catch (error) {
        console.error('❌ vvsendCommand Error:', error.message);
        try { await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }); } catch(e){}
        await sock.sendMessage(chatId, {
            text: `❌ Voice send nahi ho saka: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = vvsendCommand;
