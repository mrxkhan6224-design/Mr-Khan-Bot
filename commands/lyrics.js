const axios = require('axios');

// ============================================
// API 1: some-random-api (reliable, no key)
// ============================================
async function getLyricsSRAPI(title) {
    const url = `https://some-random-api.com/lyrics?title=${encodeURIComponent(title)}`;
    const res = await axios.get(url, { timeout: 20000 });
    if (res.data?.lyrics) {
        return {
            lyrics: res.data.lyrics,
            title: res.data.title || title,
            author: res.data.author || ''
        };
    }
    throw new Error('SRAPI: no lyrics');
}

// ============================================
// API 2: lyrics.ovh (needs artist/title)
// ============================================
async function getLyricsOVH(title) {
    // Try by splitting title (best guess)
    const parts = title.split(/\s+/);
    let lyrics = null;
    let author = '';

    // Try common splits: first word = artist, rest = title
    const attempts = [
        { artist: parts[0], song: parts.slice(1).join(' ') },
        { artist: parts.slice(0, 2).join(' '), song: parts.slice(2).join(' ') },
        { artist: parts.slice(0, 3).join(' '), song: parts.slice(3).join(' ') }
    ];

    for (const attempt of attempts) {
        if (!attempt.artist || !attempt.song) continue;
        try {
            const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(attempt.artist)}/${encodeURIComponent(attempt.song)}`;
            const res = await axios.get(url, { timeout: 20000 });
            if (res.data?.lyrics) {
                lyrics = res.data.lyrics;
                author = attempt.artist;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    if (!lyrics) throw new Error('OVH: no lyrics');
    return { lyrics, title, author };
}

// ============================================
// API 3: textyl.co (no key)
// ============================================
async function getLyricsTextyl(title) {
    const url = `https://api.textyl.co/api/lyrics?q=${encodeURIComponent(title)}`;
    const res = await axios.get(url, { timeout: 20000 });
    if (Array.isArray(res.data) && res.data.length > 0) {
        // Response is array of {seconds, lyrics}
        const fullLyrics = res.data.map(l => l.lyrics).join('\n');
        return { lyrics: fullLyrics, title, author: '' };
    }
    throw new Error('Textyl: no lyrics');
}

// ============================================
// MAIN COMMAND
// ============================================
async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, {
            text: '🔍 Please enter the song name to get the lyrics!\n\nUsage: *.lyrics <song name>*\nExample: .lyrics Tum Hi Ho'
        }, { quoted: message });
        return;
    }

    try {
        let result = null;
        let lastError = null;

        // Try each API
        const apis = [
            { name: 'some-random-api', fn: () => getLyricsSRAPI(songTitle) },
            { name: 'lyrics.ovh', fn: () => getLyricsOVH(songTitle) },
            { name: 'textyl', fn: () => getLyricsTextyl(songTitle) }
        ];

        for (const api of apis) {
            try {
                console.log(`🔍 Trying ${api.name}...`);
                result = await api.fn();
                console.log(`✅ ${api.name} succeeded`);
                break;
            } catch (err) {
                console.log(`❌ ${api.name} failed: ${err.message}`);
                lastError = err;
            }
        }

        if (!result || !result.lyrics) {
            await sock.sendMessage(chatId, {
                text: `❌ Sorry, lyrics not found for *${songTitle}*.\n\nTry with exact artist + song name.`
            }, { quoted: message });
            return;
        }

        // Build output
        let output = '';
        if (result.title || result.author) {
            output += `🎵 *${result.title || songTitle}*`;
            if (result.author) output += `\n👤 ${result.author}`;
            output += '\n\n';
        }
        output += result.lyrics;

        // WhatsApp 4096 char limit
        const maxChars = 4000;
        if (output.length > maxChars) {
            output = output.slice(0, maxChars - 3) + '...';
        }

        await sock.sendMessage(chatId, { text: output }, { quoted: message });

    } catch (error) {
        console.error('Error in lyrics command:', error?.message || error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to fetch lyrics for *${songTitle}*.\n\nTry again later.`
        }, { quoted: message });
    }
}

module.exports = { lyricsCommand };