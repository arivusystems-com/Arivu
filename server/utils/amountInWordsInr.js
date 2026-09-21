'use strict';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return twoDigits(r);
  return `${ONES[h]} Hundred${r ? ` ${twoDigits(r)}` : ''}`.trim();
}

/**
 * Convert INR major units to Indian amount-in-words (rupees + paise).
 * @param {number} amountMajor
 * @returns {string}
 */
function amountInWordsInr(amountMajor) {
  const n = Number(amountMajor);
  if (!Number.isFinite(n) || n < 0) return '';
  const rounded = Math.round(n * 100);
  const rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;

  if (rupees === 0 && paise === 0) {
    return 'Indian Rupees Zero Only.';
  }

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let out = `Indian Rupees ${parts.join(' ') || 'Zero'}`;
  if (paise) {
    out += ` and ${twoDigits(paise)} Paise`;
  }
  return `${out} Only.`;
}

module.exports = {
  amountInWordsInr,
};
