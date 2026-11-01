const axios = require('axios');

// ============================================
// 🔑 TornadoAPI Configuration
// ============================================
const TORNADO_API_KEY = 'sk_tornadoapi_trial_wp5glD_kfkucVVhuNKrUufJAPSixnHj9WuGNtUQ8Cb9nBl1tZdwgQeHU2cxJcsUcM8To1THZmqkNUAzJ67NFnw';
const TORNADO_BASE = 'https://api.tornadoapi.io';

// ============================================
// Create Job
// ============================================
async function createTornadoJob(url, quality = '720') {
    console.log('📘 Creating Facebook job...');
    const res = await axios.post(`${TORNADO_BASE}/jobs`, {
        url: url,
        format: 'mp4',
        max_resolution: quality
    }, {
        headers: {
            'x-api-key': TORNADO_API_KEY,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    if (!res.data?.job_id) {
        throw new Error('No job_id returned');
    }

    console.log(`✅ Job created: ${res.data.job_id}`);
    return res.data.job_id;
}

// ============================================
// Poll Job
// ============================================
async function pollJobStatus(jobId, maxWaitMs = 300000) {
    const start = Date.now();
    const pollInterval = 3000;

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
                throw new Error(`Job ${status}: ${res.data?.failure_reason || status}`);
            }

            await new Promise(r => setTimeout(r, pollInterval));
        } catch (e) {
            if (e.message.includes('Job')) throw e;
            await new Promise(r => setTimeout(r, pollInterval));
        }
    }
    throw new Error('Timed out');
}

// ============================================
// MAIN COMMAND
// ============================================
async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const urlMatch = text.match(/https?:\/\/[^\s]+/);

        if (!urlMatch) {
            await sock.sendMessage(chatId, {
                text: '❌ Usage: .fb <Facebook video URL>'
            }, { quoted: message });
            return;
        }

        const videoUrl = urlMatch[0];

        await sock.sendMessage(chatId, {
            text: `📘 Downloading Facebook video...\n⏳ Please wait (30-60 sec)`
        }, { quoted: message });

        // Create job
        const jobId = await createTornadoJob(videoUrl);

        // Poll until complete
        const downloadUrl = await pollJobStatus(jobId);

        // Download video
        console.log('📥 Downloading video...');
        const videoRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 180000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const videoBuffer = Buffer.from(videoRes.data);

        if (!videoBuffer || videoBuffer.length === 0) throw new Error('Empty buffer');

        // WhatsApp limit check (16MB for videos)
        const sizeMB = videoBuffer.length / (1024 * 1024);
        if (sizeMB > 64) {
            await sock.sendMessage(chatId, {
                text: `❌ Video too large (${sizeMB.toFixed(1)}MB). WhatsApp limit is ~64MB.`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: 'facebook_video.mp4',
            caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗠𝗥. 𝗞𝗛𝗔𝗡-𝗕𝗢𝗧 😈☠️`
        }, { quoted: message });

        console.log(`✅ Facebook video sent (${sizeMB.toFixed(1)}MB)`);

    } catch (err) {
        console.error('❌ Facebook error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = facebookCommand;