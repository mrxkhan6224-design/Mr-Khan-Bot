const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Text ko tukron mein todne ke liye function
function splitText(text, maxLength = 200) {
    const parts = [];
    while (text.length > 0) {
        if (text.length <= maxLength) {
            parts.push(text);
            break;
        }
        let chunk = text.substring(0, maxLength);
        let lastSpace = chunk.lastIndexOf(' ');
        if (lastSpace > 50) {
            chunk = text.substring(0, lastSpace);
        }
        parts.push(chunk);
        text = text.substring(chunk.length).trim();
    }
    return parts;
}

async function ttsCommand(sock, chatId, text, message, channelInfo) {
    try {
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide text!\n\nExample: .tts Assalamualaikum" 
            }, { quoted: message });
        }

        // Send typing indicator
        await sock.sendPresenceUpdate('recording', chatId);

        // Detect language (Urdu or English)
        const lang = /[\u0600-\u06FF]/.test(text) ? 'ur' : 'en';
        const chunks = splitText(text, 180);
        const audioParts = [];

        // Generate audio for each chunk
        for (const chunk of chunks) {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
            const res = await axios({ 
                method: 'GET', 
                url, 
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            audioParts.push(res.data);
        }

        // Combine all audio parts
        const fullAudio = Buffer.concat(audioParts);
        
        // Create temp directory if doesn't exist
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const filePath = path.join(tempDir, `tts-${Date.now()}.mp3`);
        fs.writeFileSync(filePath, fullAudio);

        // ✅ FIX: Send as MP3 file, NOT voice note
        // ptt: false means regular audio file, not voice note
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: 'audio/mpeg',
            ptt: false,  // ← YAHI FIX HAI! Voice note nahi, MP3 file
            fileName: `tts-${Date.now()}.mp3`
        }, { quoted: message });

        // Clean up temp file after 1 minute
        setTimeout(() => { 
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ TTS temp file cleaned up');
            }
        }, 60000);

        console.log('✅ TTS sent as MP3 file');

    } catch (error) {
        console.error('❌ TTS Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error generating voice: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = ttsCommand;
