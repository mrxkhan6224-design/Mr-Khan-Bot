const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function savestatusCommand(sock, chatId, message) {
    try {
        // Get quoted message (status jo reply kiya)
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        if (!quoted) {
            await sock.sendMessage(chatId, {
                text: '❌ Kisi ke *status pe reply* karke `.savestatus` bhejein'
            }, { quoted: message });
            return;
        }

        // Owner ka number (jahan status save karna hai)
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // ============================================
        // 1. IMAGE STATUS
        // ============================================
        if (quoted.imageMessage) {
            console.log('📸 Image status detected');

            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);

            const caption = quoted.imageMessage.caption || '';

            // Send to owner's self-chat
            await sock.sendMessage(ownerNumber, {
                image: buffer,
                caption: `📸 *Status Saved*\n\n${caption ? `💬 ${caption}` : ''}\n\n⏰ ${new Date().toLocaleString()}`
            });

            console.log('✅ Image status saved to self-chat');

            // React success on original reply (owner ko hi dikhega)
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            return;
        }

        // ============================================
        // 2. VIDEO STATUS
        // ============================================
        if (quoted.videoMessage) {
            console.log('🎥 Video status detected');

            const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);

            const caption = quoted.videoMessage.caption || '';

            await sock.sendMessage(ownerNumber, {
                video: buffer,
                caption: `🎥 *Status Saved*\n\n${caption ? `💬 ${caption}` : ''}\n\n⏰ ${new Date().toLocaleString()}`
            });

            console.log('✅ Video status saved to self-chat');

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            return;
        }

        // ============================================
        // 3. TEXT STATUS
        // ============================================
        const textContent = quoted.conversation || 
                           quoted.extendedTextMessage?.text || 
                           '';

        if (textContent) {
            console.log('📝 Text status detected');

            await sock.sendMessage(ownerNumber, {
                text: `📝 *Status Saved*\n\n💬 ${textContent}\n\n⏰ ${new Date().toLocaleString()}`
            });

            console.log('✅ Text status saved to self-chat');

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            return;
        }

        // ============================================
        // 4. UNSUPPORTED
        // ============================================
        await sock.sendMessage(chatId, {
            text: '❌ Ye status type supported nahi hai'
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in savestatus:', error.message);
        await sock.sendMessage(chatId, {
            text: `❌ Status save nahi ho saka: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = savestatusCommand;
