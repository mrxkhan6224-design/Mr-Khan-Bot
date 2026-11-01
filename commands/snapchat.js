const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const YTDLP_PATH = '/home/container/yt-dlp';

// ============================================
// Download Snapchat video using yt-dlp
// ============================================
async function getSnapchatVideo(videoUrl) {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const timestamp = Date.now();
    const outputTemplate = path.join(tempDir, `${timestamp}.%(ext)s`);

    if (!fs.existsSync(YTDLP_PATH)) {
        throw new Error('yt-dlp not found. Restart bot to download.');
    }

    // Clean URL (remove tracking params)
    let cleanUrl = videoUrl;
    try {
        const urlObj = new URL(videoUrl);
        cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
        console.log(`🧹 Cleaned URL: ${cleanUrl}`);
    } catch (e) {}

    console.log('👻 Downloading with yt-dlp...');

    // Download
    const downloadCmd = `"${YTDLP_PATH}" -f "best[ext=mp4]/best" -o "${outputTemplate}" --no-playlist --no-warnings "${cleanUrl}"`;

    await execAsync(downloadCmd, {
        maxBuffer: 200 * 1024 * 1024,
        timeout: 180000
    });

    // Find downloaded file
    const files = fs.readdirSync(tempDir).filter(f => f.startsWith(String(timestamp)));
    if (files.length === 0) throw new Error('No output file produced');

    const downloadedFile = path.join(tempDir, files[0]);
    const buffer = fs.readFileSync(downloadedFile);
    fs.unlinkSync(downloadedFile);

    if (!buffer || buffer.length === 0) throw new Error('Empty file');

    return { buffer };
}

// ============================================
// MAIN COMMAND
// ============================================
async function snapchatCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const urlMatch = text.match(/https?:\/\/[^\s]+/);

        if (!urlMatch) {
            await sock.sendMessage(chatId, {
                text: '❌ Usage: .snap <Snapchat Spotlight URL>'
            }, { quoted: message });
            return;
        }

        const snapUrl = urlMatch[0];

        await sock.sendMessage(chatId, {
            text: `👻 Downloading Snapchat video...\n⏳ Please wait (30-60 sec)`
        }, { quoted: message });

        const { buffer: videoBuffer } = await getSnapchatVideo(snapUrl);

        const sizeMB = videoBuffer.length / (1024 * 1024);
        if (sizeMB > 64) {
            await sock.sendMessage(chatId, {
                text: `❌ Video too large (${sizeMB.toFixed(1)}MB). WhatsApp limit ~64MB.`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: 'snapchat_video.mp4',
            caption: `👻 *Snapchat Video*\n📦 ${sizeMB.toFixed(1)}MB\n\n𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗠𝗥. 𝗞𝗛𝗔𝗡-𝗕𝗢𝗧 😈☠️`
        }, { quoted: message });

        console.log(`✅ Snapchat video sent (${sizeMB.toFixed(1)}MB)`);

    } catch (err) {
        console.error('❌ Snapchat error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = snapchatCommand;