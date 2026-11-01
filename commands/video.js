const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// ============================================
// 🔑 TornadoAPI Configuration
// ============================================
const TORNADO_API_KEY = 'sk_tornadoapi_trial_wp5glD_kfkucVVhuNKrUufJAPSixnHj9WuGNtUQ8Cb9nBl1tZdwgQeHU2cxJcsUcM8To1THZmqkNUAzJ67NFnw';
const TORNADO_BASE = 'https://api.tornadoapi.io';
const TARGET_SIZE_MB = 58; // Safe under 64MB

// ============================================
// 🧹 Clean YouTube URL
// ============================================
function cleanYouTubeUrl(url) {
    try {
        let videoId = null;
        let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (match) videoId = match[1];
        if (!videoId) {
            match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
        }
        if (!videoId) {
            match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
        }
        if (!videoId) {
            match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
        }
        if (videoId) {
            const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
            console.log(`🧹 Cleaned: ${url} → ${cleanUrl}`);
            return cleanUrl;
        }
        return url;
    } catch (e) {
        return url;
    }
}

// ============================================
// Create Video Job
// ============================================
async function createTornadoJob(videoUrl, quality = '720') {
    const cleanUrl = cleanYouTubeUrl(videoUrl);
    console.log('🎬 Creating TornadoAPI job...');

    const res = await axios.post(`${TORNADO_BASE}/jobs`, {
        url: cleanUrl,
        format: 'mp4',
        max_resolution: quality
    }, {
        headers: {
            'x-api-key': TORNADO_API_KEY,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    if (!res.data?.job_id) throw new Error('No job_id');
    console.log(`✅ Job created: ${res.data.job_id}`);
    return { jobId: res.data.job_id, duration: res.data.duration || 0 };
}

// ============================================
// Poll Job
// ============================================
async function pollJobStatus(jobId, maxWaitMs = 300000) {
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
                return { url: s3Url, duration: res.data?.duration || 0 };
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
    throw new Error('Timeout');
}

// ============================================
// Stream download
// ============================================
async function streamDownload(url, filePath) {
    const writer = fs.createWriteStream(filePath);
    const res = await axios.get(url, {
        responseType: 'stream',
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    res.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        res.data.on('error', reject);
    });
}

// ============================================
// Get video duration via ffprobe
// ============================================
function getVideoDuration(filePath) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err || !metadata) return resolve(0);
            resolve(metadata.format?.duration || 0);
        });
    });
}

// ============================================
// 🎬 Compress to Target Size (bitrate-based)
// ============================================
async function compressToTarget(inputPath, outputPath, targetMB, durationSec) {
    if (durationSec <= 0) durationSec = 300; // fallback 5 min

    // Total bitrate in kbps
    const totalBitrateKbps = Math.floor((targetMB * 8192) / durationSec);
    const audioBitrate = 96;
    const videoBitrate = Math.max(totalBitrateKbps - audioBitrate, 250); // min 250 kbps

    console.log(`🎬 Target: ${targetMB}MB | Duration: ${durationSec.toFixed(0)}s`);
    console.log(`🎬 Bitrate: total ${totalBitrateKbps}k, video ${videoBitrate}k, audio ${audioBitrate}k`);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-profile:v baseline',
                '-level 3.1',
                '-pix_fmt yuv420p',
                '-preset ultrafast',
                `-b:v ${videoBitrate}k`,
                `-maxrate ${Math.floor(videoBitrate * 1.5)}k`,
                `-bufsize ${videoBitrate * 2}k`,
                '-c:a aac',
                `-b:a ${audioBitrate}k`,
                '-movflags +faststart'
            ])
            .save(outputPath)
            .on('progress', (p) => {
                if (p.percent && p.percent % 20 < 1) {
                    console.log(`⏳ Encoding: ${p.percent.toFixed(0)}%`);
                }
            })
            .on('end', () => {
                const size = fs.statSync(outputPath).size / 1024 / 1024;
                console.log(`✅ Encoded: ${size.toFixed(1)}MB`);
                resolve();
            })
            .on('error', (err) => {
                console.error('ffmpeg error:', err.message);
                reject(err);
            });
    });
}

// ============================================
// MAIN COMMAND
// ============================================
async function videoCommand(sock, chatId, message) {
    let originalPath = null;
    let encodedPath = null;

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .video <name or YouTube link>' }, { quoted: message });
            return;
        }

        let quality = '720';
        let searchText = text;

        const qualityMatch = text.match(/^(360|480|720|1080)\s+(.+)/);
        if (qualityMatch) {
            quality = qualityMatch[1];
            searchText = qualityMatch[2];
        }

        let videoUrl, videoTitle = 'Your video', videoThumbnail = '', videoDuration = '';

        if (searchText.includes('youtube.com') || searchText.includes('youtu.be')) {
            videoUrl = searchText.trim();
        } else {
            const search = await yts(searchText);
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
                caption: `🎬 Downloading: *${videoTitle}*\n⏱ ${videoDuration || 'N/A'}\n📺 ${quality}p`
            }, { quoted: message });
        }

        // Create job
        const jobInfo = await createTornadoJob(videoUrl, quality);
        const result = await pollJobStatus(jobInfo.jobId);

        // Stream download
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        originalPath = path.join(tempDir, `vid_${Date.now()}.mp4`);
        console.log('📥 Downloading...');
        await streamDownload(result.url, originalPath);

        let finalSizeMB = fs.statSync(originalPath).size / 1024 / 1024;
        console.log(`✅ Downloaded: ${finalSizeMB.toFixed(1)}MB`);

        // Get duration
        let duration = result.duration || await getVideoDuration(originalPath);
        console.log(`📏 Duration: ${duration.toFixed(0)}s`);

        // ✅ ALWAYS re-encode to H.264 with target size
        encodedPath = path.join(tempDir, `enc_${Date.now()}.mp4`);
        await compressToTarget(originalPath, encodedPath, TARGET_SIZE_MB, duration);

        finalSizeMB = fs.statSync(encodedPath).size / 1024 / 1024;
        console.log(`✅ Final: ${finalSizeMB.toFixed(1)}MB`);

        // Send
        const safeTitle = (videoTitle || 'video').replace(/[^\w\s-]/g, '').trim() || 'video';

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(encodedPath),
            mimetype: 'video/mp4',
            fileName: `${safeTitle}.mp4`,
            caption: `🎬 *${safeTitle}*\n📺 ${quality}p | 📦 ${finalSizeMB.toFixed(1)}MB`
        }, { quoted: message });

        console.log(`✅ Sent: ${finalSizeMB.toFixed(1)}MB`);

        // Cleanup
        if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
        if (fs.existsSync(encodedPath)) fs.unlinkSync(encodedPath);

    } catch (err) {
        console.error('❌ Error:', err.message);
        if (originalPath && fs.existsSync(originalPath)) try { fs.unlinkSync(originalPath); } catch (e) {}
        if (encodedPath && fs.existsSync(encodedPath)) try { fs.unlinkSync(encodedPath); } catch (e) {}
        await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` }, { quoted: message });
    }
}

module.exports = videoCommand;