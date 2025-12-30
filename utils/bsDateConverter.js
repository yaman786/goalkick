/**
 * Bikram Sambat (BS) Date Converter
 * Converts Gregorian (AD) dates to Nepali (BS) dates
 */

// BS months in Nepali
const BS_MONTHS = [
    'बैशाख', 'जेष्ठ', 'आषाढ', 'श्रावण', 'भाद्र', 'आश्विन',
    'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];

// Days of week in Nepali
const NEPALI_DAYS = [
    'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार'
];

// Nepali numerals
const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

// BS year data - days in each month for years 2000-2090 BS
const BS_YEAR_DATA = {
    2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2083: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2084: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

// Reference date: 2080-01-01 BS = 2023-04-14 AD
const BS_REF_YEAR = 2080;
const BS_REF_MONTH = 1;
const BS_REF_DAY = 1;
const AD_REF_DATE = new Date(2023, 3, 14); // April 14, 2023

/**
 * Convert number to Nepali numerals
 */
function toNepaliNumeral(num) {
    return String(num).split('').map(d => NEPALI_DIGITS[parseInt(d)] || d).join('');
}

/**
 * Get total days in a BS year
 */
function getDaysInBSYear(year) {
    if (BS_YEAR_DATA[year]) {
        return BS_YEAR_DATA[year].reduce((a, b) => a + b, 0);
    }
    return 365; // fallback
}

/**
 * Get days in a specific BS month
 */
function getDaysInBSMonth(year, month) {
    if (BS_YEAR_DATA[year] && BS_YEAR_DATA[year][month - 1]) {
        return BS_YEAR_DATA[year][month - 1];
    }
    return 30; // fallback
}

/**
 * Convert AD date to BS date
 */
function adToBS(adDate) {
    const date = new Date(adDate);

    // Calculate days difference from reference date
    const diffTime = date.getTime() - AD_REF_DATE.getTime();
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let bsYear = BS_REF_YEAR;
    let bsMonth = BS_REF_MONTH;
    let bsDay = BS_REF_DAY;

    // Add days
    bsDay += diffDays;

    // Normalize the date
    while (bsDay > getDaysInBSMonth(bsYear, bsMonth)) {
        bsDay -= getDaysInBSMonth(bsYear, bsMonth);
        bsMonth++;
        if (bsMonth > 12) {
            bsMonth = 1;
            bsYear++;
        }
    }

    while (bsDay < 1) {
        bsMonth--;
        if (bsMonth < 1) {
            bsMonth = 12;
            bsYear--;
        }
        bsDay += getDaysInBSMonth(bsYear, bsMonth);
    }

    return {
        year: bsYear,
        month: bsMonth,
        day: bsDay,
        dayOfWeek: date.getDay()
    };
}

/**
 * Format BS date in Nepali
 * @param {Date} adDate - JavaScript Date object (Gregorian)
 * @returns {string} Formatted date in Nepali (e.g., "२०८२ माघ १५, बिहिबार")
 */
function formatBSDate(adDate) {
    const bs = adToBS(adDate);

    const nepaliYear = toNepaliNumeral(bs.year);
    const nepaliMonth = BS_MONTHS[bs.month - 1];
    const nepaliDay = toNepaliNumeral(bs.day);
    const nepaliDayOfWeek = NEPALI_DAYS[bs.dayOfWeek];

    return `${nepaliYear} ${nepaliMonth} ${nepaliDay}, ${nepaliDayOfWeek}`;
}

/**
 * Format BS date short (without day of week)
 */
function formatBSDateShort(adDate) {
    const bs = adToBS(adDate);

    const nepaliYear = toNepaliNumeral(bs.year);
    const nepaliMonth = BS_MONTHS[bs.month - 1];
    const nepaliDay = toNepaliNumeral(bs.day);

    return `${nepaliYear} ${nepaliMonth} ${nepaliDay}`;
}

module.exports = {
    adToBS,
    formatBSDate,
    formatBSDateShort,
    toNepaliNumeral,
    BS_MONTHS,
    NEPALI_DAYS,
    NEPALI_DIGITS
};
