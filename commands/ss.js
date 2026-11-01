const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ============================================
// 🎯 API 1: Microlink (25 req/day free, no key)
// ============================================
async function screenshotMicrolink(url) {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
    });

    if (!response.ok) {
        throw new Error(`Microlink: HTTP ${response.status}`);
    }

    return await response.buffer();
}

// ============================================
// 🎯 API 2: 11ty Screenshot (free, no key)
// ============================================
async function screenshot11ty(url) {
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `https://v1.screenshot.11ty.dev/${encodedUrl}/large/1:1/`;
    const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
    });

    if (!response.ok) {
        throw new Error(`11ty: HTTP ${response.status}`);
    }

    return await response.buffer();
}

// ============================================
// 🎯 API 3: Robocular Gateway (50 req/day free)
// ============================================
async function screenshotRobocular(url) {
    const apiUrl = `https://agent-gateway-kappa.vercel.app/v1/agent-screenshot/api/screenshot?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
    });

    if (!response.ok) {
        throw new Error(`Robocular: HTTP ${response.status}`);
    }

    return await response.buffer();
}

// ============================================
// 🎯 API 4: Original siputzx (fallback)
// ============================================
async function screenshotSiputzx(url) {
    const apiUrl = `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}&theme=light&device=desktop`;
    const response = await fetch(apiUrl, {
        headers: { 'accept': '*/*' },
        timeout: 30000
    });

    if (!response.ok) {
        throw new Error(`siputzx: HTTP ${response.status}`);
    }

    return await response.buffer();
}

// ============================================
// 🎯 MAIN COMMAND
// ============================================
async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `*SCREENSHOT TOOL*\n\n*.ss <url>*\n*.ssweb <url>*\n*.screenshot <url>*\n\nTake a screenshot of any website\n\nExample:\n.ss https://google.com`,
            quoted: message
        });
        return;
    }

    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        const url = match.trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide a valid URL starting with http:// or https://',
                quoted: message
            });
        }

        console.log(`📸 Taking screenshot: ${url}`);

        let imageBuffer = null;
        let lastError = null;

        // ✅ Try each API in order
        const apis = [
            { name: 'Microlink', fn: () => screenshotMicrolink(url) },
            { name: '11ty', fn: () => screenshot11ty(url) },
            { name: 'Robocular', fn: () => screenshotRobocular(url) },
            { name: 'siputzx', fn: () => screenshotSiputzx(url) }
        ];

        for (const api of apis) {
            try {
                console.log(`🔄 Trying ${api.name}...`);
                const buffer = await api.fn();

                if (buffer && buffer.length > 5000) {
                    imageBuffer = buffer;
                    console.log(`✅ ${api.name} succeeded (${(buffer.length / 1024).toFixed(1)}KB)`);
                    break;
                } else {
                    console.log(`⚠️ ${api.name} returned small buffer`);
                }
            } catch (err) {
                console.log(`❌ ${api.name} failed: ${err.message}`);
                lastError = err;
            }
        }

        if (!imageBuffer) {
            throw new Error(`All screenshot APIs failed. Last error: ${lastError?.message || 'Unknown'}`);
        }

        // Send screenshot
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: `📸 *${url}*`
        }, {
            quoted: message
        });

        console.log(`✅ Screenshot sent`);

    } catch (error) {
        console.error('❌ Error in ss command:', error.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to take screenshot.\n\nReason: ${error.message}\n\nPossible reasons:\n• Invalid URL\n• Website blocking screenshots\n• Website is down`
        }, {
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
};