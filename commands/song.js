const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');

// ============================================
// 🔑 TornadoAPI Configuration
// ============================================
const TORNADO_API_KEY = 'sk_tornadoapi_trial_wp5glD_kfkucVVhuNKrUufJAPSixnHj9WuGNtUQ8Cb9nBl1tZdwgQeHU2cxJcsUcM8To1THZmqkNUAzJ67NFnw';
const TORNADO_BASE = 'https://api.tornadoapi.io';

// ============================================
// Create Job via TornadoAPI
// ============================================
async function createTornadoJob(videoUrl) {
    console.log('🎵 Creating TornadoAPI job...');
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

    if (!res.data?.job_id) {
        throw new Error('No job_id returned: ' + JSON.stringify(res.data));
    }

    console.log(`✅ Job created: ${res.data.job_id}`);
    return res.data.job_id;
}

// ============================================
// Poll Job Status
// ============================================
async function pollJobStatus(jobId, maxWaitMs = 180000) {
    const start = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - start < maxWaitMs) {
        try {
            const res = await axios.get(`${TORNADO_BASE}/jobs/${jobId}`, {
                headers: { 'x-api-key': TORNADO_API_KEY },
                timeout: 20000
            });

            const status = res.data?.status;
            console.log(`⏳ Job status: ${status}`);

            if (status === 'Completed') {
                const s3Url = res.data?.s3_url;
                if (!s3Url) throw new Error('No s3_url in completed response');
                console.log('✅ Job completed!');
                return s3Url;
            }

            if (['Failed', 'Warning', 'Skipped', 'Cancelled', 'CancelledByAdmin'].includes(status)) {
                const reason = res.data?.failure_reason || res.data?.reason || status;
                throw new Error(`Job ${status}: ${reason}`);
            }

            // Pending or Processing - wait and retry
            await new Promise(r => setTimeout(r, pollInterval));
        } catch (e) {
            if (e.message.includes('Job')) throw e; // Job failed, rethrow
            console.log(`⚠️ Poll error: ${e.message}`);
            await new Promise(r => setTimeout(r, pollInterval));
        }
    }

    throw new Error('Job timed out (3 min)');
}

// ============================================
// MAIN COMMAND
// ============================================
async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let videoUrl, videoTitle = 'Your song', videoThumbnail = '', videoDuration = '';

        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            videoUrl = text.trim();
        } else {
            const search = await yts(text);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
                return;
            }
            const first = search.videos[0];
            videoUrl = first.url;
            videoTitle = first.title;
            videoThumbnail = first.thumbnail;
            videoDuration = first.timestamp;
        }

        if (videoThumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: videoThumbnail },
                caption: `🎵 Downloading: *${videoTitle}*\n⏱ Duration: ${videoDuration || 'N/A'}`
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: `🎵 Downloading: *${videoTitle}*...` }, { quoted: message });
        }

        // Step 1: Create job
        const jobId = await createTornadoJob(videoUrl);

        // Step 2: Poll until complete
        const audioUrl = await pollJobStatus(jobId);

        // Step 3: Download audio
        console.log('📥 Downloading audio file...');
        const audioRes = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const audioBuffer = Buffer.from(audioRes.data);

        if (!audioBuffer || audioBuffer.length === 0) throw new Error('Empty audio buffer');
        console.log(`✅ Downloaded ${audioBuffer.length} bytes`);

        // Step 4: Detect format
        const firstBytes = audioBuffer.slice(0, 12);
        const asciiSig = firstBytes.toString('ascii', 4, 8);
        let fileExtension = 'mp3';

        if (asciiSig === 'ftyp') fileExtension = 'm4a';
        else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') fileExtension = 'ogg';
        else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') fileExtension = 'wav';
        else if (audioBuffer[0] === 0x1A && audioBuffer[1] === 0x45) fileExtension = 'webm';

        // Step 5: Convert to MP3 if needed
        let finalBuffer = audioBuffer;
        let finalMimetype = 'audio/mpeg';
        let finalExtension = fileExtension;

        if (fileExtension !== 'mp3') {
            try {
                console.log(`🔄 Converting ${fileExtension} to MP3...`);
                finalBuffer = await toAudio(audioBuffer, fileExtension);
                finalExtension = 'mp3';
                finalMimetype = 'audio/mpeg';
                console.log('✅ Conversion successful');
            } catch (e) {
                console.log(`⚠️ Conversion failed, sending ${fileExtension}`);
                finalMimetype = fileExtension === 'm4a' ? 'audio/mp4' : 'audio/webm';
            }
        }

        const safeTitle = (videoTitle || 'song').replace(/[^\w\s-]/g, '').trim() || 'song';

        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMimetype,
            fileName: `${safeTitle}.${finalExtension}`,
            ptt: false
        }, { quoted: message });

        console.log(`✅ Song sent: ${safeTitle}.${finalExtension}`);

    } catch (err) {
        console.error('❌ Song command error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = songCommand;