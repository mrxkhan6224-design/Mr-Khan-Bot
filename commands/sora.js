const { Client } = require("@gradio/client");
const axios = require('axios');

// ============================================
// 🎬 HuggingFace Spaces (Correct Endpoints)
// ============================================
async function generateWithRealtimeVideo(prompt) {
    console.log('🎬 Connecting to KingNish/Realtime-Video-Generator...');

    const client = await Client.connect("KingNish/Realtime-Video-Generator");

    // Ye space 2 endpoints use karti hai — pehle `/predict` try karo
    const result = await client.predict("/predict", {
        prompt: prompt
    });

    console.log('✅ Got response from space');
    console.log('Response:', JSON.stringify(result.data).slice(0, 500));

    // Response structure check karo
    const videoUrl = findVideoUrl(result.data);
    if (!videoUrl) throw new Error('No video in response');

    return videoUrl;
}

// Recursively find video URL
function findVideoUrl(data) {
    if (!data) return null;
    if (typeof data === 'string') {
        if (data.startsWith('http')) return data;
    }
    if (data.url) return data.url;
    if (data.video?.url) return data.video.url;
    if (Array.isArray(data)) {
        for (const item of data) {
            const found = findVideoUrl(item);
            if (found) return found;
        }
    }
    if (typeof data === 'object') {
        for (const key of Object.keys(data)) {
            const found = findVideoUrl(data[key]);
            if (found) return found;
        }
    }
    return null;
}

// Download video
async function downloadVideo(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 180000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
}

// ============================================
// MAIN COMMAND
// ============================================
async function soraCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.sora';
        const args = rawText.slice(used.length).trim();

        if (!args) {
            await sock.sendMessage(chatId, {
                text: 'Provide a prompt. Example: .sora anime girl with short blue hair'
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: '🎬 Generating video... Please wait (1-3 min). Queue may be busy.'
        }, { quoted: message });

        // Generate
        const videoUrl = await generateWithRealtimeVideo(args);
        console.log('📥 Downloading video from:', videoUrl);

        const videoBuffer = await downloadVideo(videoUrl);

        if (!videoBuffer || videoBuffer.length < 10000) {
            throw new Error('Video too small / invalid');
        }

        const sizeMB = videoBuffer.length / (1024 * 1024);
        console.log(`✅ Video: ${sizeMB.toFixed(2)}MB`);

        if (sizeMB > 64) {
            await sock.sendMessage(chatId, {
                text: `❌ Video too large (${sizeMB.toFixed(1)}MB). WhatsApp limit ~64MB.`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: `🎬 *AI Video*\n📝 Prompt: ${args}`
        }, { quoted: message });

        console.log('[SORA] ✅ Video sent');

    } catch (error) {
        console.error('[SORA] error:', error?.message || error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${error.message}\n\nHuggingFace Space busy ya offline hai. 1-2 min baad try karein.`
        }, { quoted: message });
    }
}

module.exports = soraCommand;