const fetch = require('node-fetch');

async function quranCommand(sock, chatId, message) {
    try {
        const userMessage = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || '';
        const args = userMessage.split(' ');
        const surahInput = args[1];

        if (!surahInput) {
            await sock.sendMessage(chatId, {
                text: `❌ براہ کرم سورہ نمبر یا نام دیں!\n\n📖 استعمال: .quran 1\n📖 یا: .quran الفاتحہ\n\n📚 سورہ فہرست: .surahmenu`
            }, { quoted: message });
            return;
        }

        // Surah number یا name check کریں
        let surahNumber;
        if (!isNaN(surahInput)) {
            surahNumber = parseInt(surahInput);
        } else {
            // Surah name سے number تلاش کریں
            const surahNames = {
                'الفاتحہ': 1, 'فاتحہ': 1, 'alfatiha': 1,
                'البقرہ': 2, 'بقرہ': 2, 'albaqarah': 2,
                'آل عمران': 3, 'عمران': 3, 'aleimran': 3,
                'النساء': 4, 'نساء': 4, 'annisa': 4,
                'المائدة': 5, 'مائدة': 5, 'almaidah': 5,
                'الأنعام': 6, 'أنعام': 6, 'alanam': 6,
                'الأعراف': 7, 'اعراف': 7, 'alaraf': 7,
                'الأنفال': 8, 'أنفال': 8, 'alanfal': 8,
                'التوبة': 9, 'توبة': 9, 'attawbah': 9,
                'يونس': 10, 'یونس': 10, 'yunus': 10,
                'هود': 11, 'ہود': 11, 'hud': 11,
                'يوسف': 12, 'یوسف': 12, 'yusuf': 12,
                'الرعد': 13, 'رعد': 13, 'arrad': 13,
                'ابراهيم': 14, 'ابراہیم': 14, 'ibrahim': 14,
                'الحجر': 15, 'حجر': 15, 'alhijr': 15,
                'النحل': 16, 'نحل': 16, 'annahl': 16,
                'الإسراء': 17, 'اسراء': 17, 'alisra': 17,
                'الكهف': 18, 'کہف': 18, 'alkahf': 18,
                'مريم': 19, 'مریم': 19, 'maryam': 19,
                'طه': 20, 'طہ': 20, 'taha': 20,
                'الأنبياء': 21, 'انبیاء': 21, 'alambiya': 21,
                'الحج': 22, 'حج': 22, 'alhajj': 22,
                'المؤمنون': 23, 'مؤمنون': 23, 'almuminun': 23,
                'النور': 24, 'نور': 24, 'annur': 24,
                'الفرقان': 25, 'فرقان': 25, 'alfurqan': 25,
                'الشعراء': 26, 'شعراء': 26, 'ashshuara': 26,
                'النمل': 27, 'نمل': 27, 'annaml': 27,
                'القصص': 28, 'قصص': 28, 'alqasas': 28,
                'العنكبوت': 29, 'عنکبوت': 29, 'alankabut': 29,
                'الروم': 30, 'روم': 30, 'arrom': 30,
                'لقمان': 31, 'luqman': 31,
                'السجدة': 32, 'سجدة': 32, 'assajdah': 32,
                'الأحزاب': 33, 'احزاب': 33, 'alahzab': 33,
                'سبإ': 34, 'سبا': 34, 'saba': 34,
                'فاطر': 35, 'fatir': 35,
                'يس': 36, 'یٰسین': 36, 'yaseen': 36,
                'الصافات': 37, 'صافات': 37, 'assaffat': 37,
                'ص': 38, 'صاد': 38, 'sad': 38,
                'الزمر': 39, 'زمر': 39, 'azzumar': 39,
                'غافر': 40, 'غافر': 40, 'ghafir': 40,
                'فصلت': 41, 'fussilat': 41,
                'الشورى': 42, 'شوری': 42, 'ashshura': 42,
                'الزخرف': 43, 'زخرف': 43, 'azzukhruf': 43,
                'الدخان': 44, 'دخان': 44, 'addukhan': 44,
                'الجاثية': 45, 'جاثیہ': 45, 'aljathiya': 45,
                'الأحقاف': 46, 'احقاف': 46, 'alahqaf': 46,
                'محمد': 47, 'muhammad': 47,
                'الفتح': 48, 'فتح': 48, 'alfath': 48,
                'الحجرات': 49, 'حجرات': 49, 'alhujurat': 49,
                'ق': 50, 'قاف': 50, 'qaf': 50,
                'الذاريات': 51, 'ذاریات': 51, 'adhariat': 51,
                'الطور': 52, 'طور': 52, 'attur': 52,
                'النجم': 53, 'نجم': 53, 'annajm': 53,
                'القمر': 54, 'قمر': 54, 'alqamar': 54,
                'الرحمن': 55, 'رحمن': 55, 'arrahman': 55,
                'الواقعة': 56, 'واقعہ': 56, 'alwaqiah': 56,
                'الحديد': 57, 'حدید': 57, 'alhadid': 57,
                'المجادلة': 58, 'مجادلہ': 58, 'almujadila': 58,
                'الحشر': 59, 'حشر': 59, 'alhashr': 59,
                'الممتحنة': 60, 'ممتحنہ': 60, 'almumtahanah': 60,
                'الصف': 61, 'صف': 61, 'assaf': 61,
                'الجمعة': 62, 'جمعہ': 62, 'aljumua': 62,
                'المنافقون': 63, 'منافقون': 63, 'almunafiqun': 63,
                'التغابن': 64, 'تغابن': 64, 'attaghabun': 64,
                'الطلاق': 65, 'طلاق': 65, 'attalaq': 65,
                'التحريم': 66, 'تحریم': 66, 'attahrim': 66,
                'الملك': 67, 'ملک': 67, 'almulk': 67,
                'القلم': 68, 'قلم': 68, 'alqalam': 68,
                'الحاقة': 69, 'حاقہ': 69, 'alhaqqah': 69,
                'المعارج': 70, 'معارج': 70, 'almaarij': 70,
                'نوح': 71, 'نوح': 71, 'nuh': 71,
                'الجن': 72, 'جن': 72, 'aljinn': 72,
                'المزمل': 73, 'مزمل': 73, 'almuzzammil': 73,
                'المدثر': 74, 'مدثر': 74, 'almuddathir': 74,
                'القيامة': 75, 'قیامت': 75, 'alqiyamah': 75,
                'الانسان': 76, 'انسان': 76, 'alinsan': 76,
                'المرسلات': 77, 'مرسلات': 77, 'almursalat': 77,
                'النبأ': 78, 'نباء': 78, 'annaba': 78,
                'النازعات': 79, 'نازعات': 79, 'annaziat': 79,
                'عبس': 80, 'abasa': 80,
                'التكوير': 81, 'تکویر': 81, 'attakwir': 81,
                'الانفطار': 82, 'انفطار': 82, 'alinfitar': 82,
                'المطففين': 83, 'مطففین': 83, 'almutaffifin': 83,
                'الانشقاق': 84, 'انشقاق': 84, 'alinshiqaq': 84,
                'البروج': 85, 'بروج': 85, 'alburuj': 85,
                'الطارق': 86, 'طارق': 86, 'attariq': 86,
                'الأعلى': 87, 'اعلی': 87, 'alaala': 87,
                'الغاشية': 88, 'غاشیہ': 88, 'alghashiyah': 88,
                'الفجر': 89, 'فجر': 89, 'alfajr': 89,
                'البلد': 90, 'بلد': 90, 'albalad': 90,
                'الشمس': 91, 'شمس': 91, 'ashshams': 91,
                'الليل': 92, 'لیل': 92, 'allail': 92,
                'الضحى': 93, 'ضحی': 93, 'adduha': 93,
                'الشرح': 94, 'شرح': 94, 'ashsharh': 94,
                'التين': 95, 'تین': 95, 'attin': 95,
                'العلق': 96, 'علق': 96, 'alaq': 96,
                'القدر': 97, 'قدر': 97, 'alqadr': 97,
                'البينة': 98, 'بینہ': 98, 'albayyinah': 98,
                'الزلزلة': 99, 'زلزلہ': 99, 'azzalzalah': 99,
                'العاديات': 100, 'عادیات': 100, 'aladiyat': 100,
                'القارعة': 101, 'قارعہ': 101, 'alqariah': 101,
                'التكاثر': 102, 'تکاثر': 102, 'attakathur': 102,
                'العصر': 103, 'عصر': 103, 'alasr': 103,
                'الهمزة': 104, 'ہمزہ': 104, 'alhumazah': 104,
                'الفيل': 105, 'فیل': 105, 'alfil': 105,
                'قريش': 106, 'قریش': 106, 'quraish': 106,
                'الماعون': 107, 'ماعون': 107, 'almaun': 107,
                'الكوثر': 108, 'کوثر': 108, 'alkawthar': 108,
                'الكافرون': 109, 'کافرون': 109, 'alkafirun': 109,
                'النصر': 110, 'نصر': 110, 'annasr': 110,
                'المسد': 111, 'مسد': 111, 'allahab': 111,
                'الإخلاص': 112, 'اخلاص': 112, 'alikhlas': 112,
                'الفلق': 113, 'فلق': 113, 'alfalaq': 113,
                'الناس': 114, 'ناس': 114, 'annas': 114
            };
            
            const surahName = surahInput.toLowerCase();
            surahNumber = surahNames[surahName];
            
            if (!surahNumber) {
                await sock.sendMessage(chatId, {
                    text: `❌ سورہ "${surahInput}" نہیں ملی۔\n\n📚 سورہ فہرست: .surahmenu`
                }, { quoted: message });
                return;
            }
        }

        // Surah نمبر 1 سے 114 کے درمیان ہونا چاہیے
        if (surahNumber < 1 || surahNumber > 114) {
            await sock.sendMessage(chatId, {
                text: `❌ سورہ نمبر 1 سے 114 کے درمیان ہونا چاہیے۔\n\n📚 مکمل فہرست: .surahmenu`
            }, { quoted: message });
            return;
        }

        // Quran API سے data fetch کریں
        console.log(`📖 Fetching Surah ${surahNumber}...`);
        
        // alquran.cloud API استعمال کریں
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
        const data = await response.json();

        if (!data.data) {
            throw new Error('Surah data not found');
        }

        const surah = data.data;
        
        // Surah info تیار کریں
        const quranText = `
🕋 *القرآن الکریم*

📖 *سورہ ${surah.number}: ${surah.englishName}*
✨ *(${surah.name})*

📊 *معلومات:*
• اردو نام: ${surah.englishNameTranslation || "دستیاب نہیں"}
• آیات: ${surah.numberOfAyahs}
• نوع: ${surah.revelationType === "Meccan" ? "مکی" : "مدنی"}

🎧 *تلاوت:* https://quran.com/${surah.number}

❄️ *استعمال:* .quran ${surah.number}:آیت نمبر
مثال: .quran ${surah.number}:1`;

        await sock.sendMessage(chatId, { 
            text: quranText 
        }, { quoted: message });

        // Audio recitation (optionally send)
        if (surahNumber <= 10) { // پہلی 10 سورتوں کے لیے audio
            await sock.sendMessage(chatId, {
                text: `🎧 *تلاوت سنیں:*\nhttps://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/00${surahNumber.toString().padStart(3, '0')}.mp3`
            });
        }

    } catch (error) {
        console.error('❌ Quran Command Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ خرابی: ${error.message}\n\n📖 استعمال: .quran 1\n📚 فہرست: .surahmenu`
        }, { quoted: message });
    }
}

module.exports = quranCommand;