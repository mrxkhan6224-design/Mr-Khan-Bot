const axios = require('axios');

// ============================================
// Pinterest Command - Search & Download
// Uses free public APIs (no key required)
// ============================================

// API 1: Cedds PinDL (works with pin.it and pinterest.com URLs)
async function getPinFromCedds(url) {
    const apiUrl = `https://cedds-api.duckdns.org/downloader/pintedl?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiUrl, { timeout: 25000 });
    if (res.data?.success && res.data?.data?.downloads?.length > 0) {
        const downloads = res.data.data.downloads;
        // Prefer highest quality image or video
        const image = downloads.find(d => d.type === 'image') || downloads[0];
        return {
            type: image.type || 'image',
            url: image.url,
            title: res.data.data.title || 'Pinterest Pin',
            thumbnail: res.data.data.thumbnail || image.url
        };
    }
    throw new Error('Cedds API returned no downloads');
}

// API 2: pin.vinayop.cloud (metadata + image URL)
async function getPinFromVinayop(url) {
    const res = await axios.post('https://pin.vinayop.cloud/pin', {
        url: url
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
    });

    if (res.data?.image) {
        return {
            type: 'image',
            url: res.data.image,
            title: res.data.title || 'Pinterest Pin',
            thumbnail: res.data.image
        };
    }
    if (res.data?.video) {
        return {
            type: 'video',
            url: res.data.video,
            title: res.data.title || 'Pinterest Pin',
            thumbnail: res.data.thumbnail || res.data.image
        };
    }
    throw new Error('Vinayop API returned no media');
}

// ============================================
// MAIN COMMAND
// ============================================
async function pinterestCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            '';
        const used = (rawText || '').split(/\s+/)[0] || '.pin';
        const url = rawText.slice(used.length).trim();

        if (!url) {
            await sock.sendMessage(chatId, {
                text: `📌 *Pinterest Downloader*\n\nUsage: *.pin <Pinterest URL>*\n\nExamples:\n.pin https://pin.it/xxxxx\n.pin https://www.pinterest.com/pin/123456789/`
            }, { quoted: message });
            return;
        }

        // Validate URL
        if (!url.includes('pinterest.com') && !url.includes('pin.it')) {
            await sock.sendMessage(chatId, {
                text: '❌ Please provide a valid Pinterest URL (pin.it or pinterest.com)'
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: '📌 Downloading from Pinterest...'
        }, { quoted: message });

        // Try APIs with fallback
        let result;
        let downloadSuccess = false;

        // Try Cedds first
        try {
            console.log('📌 Trying Cedds PinDL...');
            result = await getPinFromCedds(url);
            downloadSuccess = true;
            console.log('✅ Cedds succeeded');
        } catch (e) {
            console.log(`❌ Cedds failed: ${e.message}`);
        }

        // Fallback: Vinayop
        if (!downloadSuccess) {
            try {
                console.log('📌 Trying Vinayop...');
                result = await getPinFromVinayop(url);
                downloadSuccess = true;
                console.log('✅ Vinayop succeeded');
            } catch (e) {
                console.log(`❌ Vinayop failed: ${e.message}`);
            }
        }

        if (!downloadSuccess || !result) {
            throw new Error('All Pinterest APIs failed');
        }

        // Download media
        console.log('📥 Downloading media...');
        const mediaRes = await axios.get(result.url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const buffer = Buffer.from(mediaRes.data);

        if (!buffer || buffer.length === 0) throw new Error('Empty buffer');

        const sizeMB = buffer.length / (1024 * 1024);

        // Send based on type
        if (result.type === 'video') {
            await sock.sendMessage(chatId, {
                video: buffer,
                mimetype: 'video/mp4',
                fileName: 'pinterest_video.mp4',
                caption: `📌 *Pinterest Video*\n📦 ${sizeMB.toFixed(1)}MB`
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                image: buffer,
                caption: `📌 *Pinterest Image*\n📦 ${sizeMB.toFixed(1)}MB`
            }, { quoted: message });
        }

        console.log(`✅ Pinterest ${result.type} sent (${sizeMB.toFixed(1)}MB)`);

    } catch (err) {
        console.error('❌ Pinterest command error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${err.message}\n\nMake sure the Pinterest link is valid and public.`
        }, { quoted: message });
    }
}

module.exports = pinterestCommand;