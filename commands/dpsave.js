const axios = require('axios');

async function dpsaveCommand(sock, chatId, message) {
    try {
        // Get target user (from reply, mention, or self)
        let targetJid;
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const isGroup = chatId.endsWith('@g.us');

        if (ctx?.mentionedJid?.length > 0) {
            // 1. Mention kiya gaya
            targetJid = ctx.mentionedJid[0];
        } else if (ctx?.participant) {
            // 2. Kisi ke message par reply
            targetJid = ctx.participant;
        } else if (isGroup) {
            // 3. Group mein na mention na reply → poocho
            await sock.sendMessage(chatId, {
                text: '❌ Jis ki DP chahiye usay *mention* karo ya us ke message par *reply* karo.'
            }, { quoted: message });
            return;
        } else {
            // 4. DM mein na mention na reply → jis ko message kiya us ki DP
            targetJid = chatId;
        }

        // Show loading reaction
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Try HD profile picture first, then preview
        let url = null;
        try {
            url = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            try {
                url = await sock.profilePictureUrl(targetJid, 'preview');
            } catch (e2) {
                await sock.sendMessage(chatId, {
                    text: '❌ Is user ki DP nahi mil rahi ya private hai.'
                }, { quoted: message });
                return;
            }
        }

        if (!url) {
            await sock.sendMessage(chatId, {
                text: '❌ DP nahi mili.'
            }, { quoted: message });
            return;
        }

        // Download image
        console.log(`📸 Downloading DP: ${url}`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buffer = Buffer.from(response.data);

        if (!buffer || buffer.length < 1000) {
            throw new Error('Invalid image buffer');
        }

        const number = targetJid.split('@')[0];
        const sizeKB = (buffer.length / 1024).toFixed(1);
        console.log(`✅ DP downloaded: ${sizeKB}KB`);

        // Send only as image (long press to save)
        await sock.sendMessage(chatId, {
            image: buffer,
            caption: `📸 *Profile Picture*\n👤 @${number}\n📦 ${sizeKB}KB\n\n💾 𝗗𝗣 𝗦𝗔𝗩𝗘𝗗 𝗕𝗬 𝗠𝗥. 𝗞𝗛𝗔𝗡-𝗕𝗢𝗧 😈☠️`,
            mentions: [targetJid]
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        console.log(`✅ DP saved for ${number}`);

    } catch (error) {
        console.error('❌ Error in dpsave:', error.message);
        await sock.sendMessage(chatId, {
            text: `❌ DP save nahi ho saki. Reason: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = dpsaveCommand;
