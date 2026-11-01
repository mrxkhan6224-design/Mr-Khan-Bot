const axios = require('axios');
const yts = require('yt-search');

// ============================================
// 🔑 TornadoAPI Configuration
// ============================================
const TORNADO_API_KEY = 'sk_tornadoapi_trial_wp5glD_kfkucVVhuNKrUufJAPSixnHj9WuGNtUQ8Cb9nBl1tZdwgQeHU2cxJcsUcM8To1THZmqkNUAzJ67NFnw';
const TORNADO_BASE = 'https://api.tornadoapi.io';

// ============================================
// Create Job
// ============================================
async function createTornadoJob(videoUrl) {
    console.log('🎵 Creating Spotify→YouTube job...');
    const res = await axios.post(`${TORNADO_BASE}/jobs`, {
        url: videoUrl,
        format: 'mp3'
    }, {
        headers: {
            'x-api-key': TORNADO_API_KEY,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    if (!res.data?.job_id) throw new Error('No job_id');
    console.log(`✅ Job: ${res.data.job_id}`);
    return res.data.job_id;
}

// ============================================
// Poll Job
// ============================================
async function pollJobStatus(jobId, maxWaitMs = 180000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        try {
            const res = await axios.get(`${TORNADO_BASE}/jobs/${jobId}`, {
                headers: { 'x-api-key': TORNADO_API_KEY },
                timeout: 20000
            });
            const status = res.data?.status;
            console.log(`⏳ ${status}`);

            if (status === 'Completed') {
                const s3Url = res.data?.s3_url;
                if (!s3Url) throw new Error('No s3_url');
                return s3Url;
            }
            if (['Failed', 'Warning', 'Skipped', 'Cancelled', 'CancelledByAdmin'].includes(status)) {
                throw new Error(`Job ${status}`);
            }
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            if (e.message.includes('Job')) throw e;
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    throw new Error('Timed out');
}

// ============================================
// MAIN COMMAND
// ============================================
async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text: 'Usage: .spotify <song/artist>\nExample: .spotify con calma'
            }, { quoted: message });
            return;
        }

        // Step 1: Search YouTube for the track (Spotify audio is DRM-protected)
        console.log(`🔎 Searching: ${query}`);
        const search = await yts(query + ' audio');
        if (!search || !search.videos.length) {
            await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
            return;
        }
        const video = search.videos[0];

        // Send preview
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp}`
        }, { quoted: message });

        // Step 2: Create Tornado job
        const jobId = await createTornadoJob(video.url);

        // Step 3: Poll
        const audioUrl = await pollJobStatus(jobId);

        // Step 4: Download audio
        console.log('📥 Downloading...');
        const audioRes = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const audioBuffer = Buffer.from(audioRes.data);

        if (!audioBuffer || audioBuffer.length === 0) throw new Error('Empty buffer');

        const safeTitle = (video.title || 'track').replace(/[^\w\s-]/g, '').trim() || 'track';

        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            ptt: false
        }, { quoted: message });

        console.log(`✅ Sent: ${safeTitle}`);

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = spotifyCommand;