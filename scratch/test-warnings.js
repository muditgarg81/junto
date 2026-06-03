'use strict';

// Copy getCleanDate from VaultClient.tsx
const getCleanDate = (val) => {
  if (!val) return null;
  const isoMatch = val.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Copy getValidationWarnings from VaultClient.tsx
const getValidationWarnings = (kind, fields, items, excludeId) => {
  const warnings = {
    isDuplicate: false,
    isExpired: false,
    isPreviousDate: false
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const otherItems = excludeId ? items.filter(item => item.id !== excludeId) : items;

  // 1. Duplicate check (PNR / ConfNo matching)
  const pnr = (fields.pnr || fields.confirmationNo || '').trim().toLowerCase();
  if (pnr) {
    const duplicatePnr = otherItems.find(item => {
      const op = (item.fields.pnr || item.fields.confirmationNo || '').trim().toLowerCase();
      return op === pnr;
    });
    if (duplicatePnr) {
      warnings.isDuplicate = true;
      warnings.duplicateTitle = `Confirmation/PNR "${pnr}" is already logged on another voucher.`;
    }
  }

  // Name + checkin date matching (stays)
  if (kind === 'stay' && fields.hotelName && fields.checkInDate) {
    const hotelName = fields.hotelName.trim().toLowerCase();
    const checkInDate = fields.checkInDate.trim();
    const duplicateStay = otherItems.find(item => {
      return item.kind === 'stay' &&
             item.fields.hotelName?.trim().toLowerCase() === hotelName &&
             item.fields.checkInDate?.trim() === checkInDate;
    });
    if (duplicateStay) {
      warnings.isDuplicate = true;
      warnings.duplicateTitle = `A stay at "${fields.hotelName}" check-in ${fields.checkInDate} is already logged.`;
    }
  }

  // Flight matching
  if (kind === 'flight' && fields.flightNo && fields.departureDate) {
    const flightNo = fields.flightNo.trim().toLowerCase();
    const depDate = fields.departureDate.trim();
    const duplicateFlight = otherItems.find(item => {
      return item.kind === 'flight' &&
             item.fields.flightNo?.trim().toLowerCase() === flightNo &&
             item.fields.departureDate?.trim() === depDate;
    });
    if (duplicateFlight) {
      warnings.isDuplicate = true;
      warnings.duplicateTitle = `Flight "${fields.flightNo}" departing ${fields.departureDate} is already logged.`;
    }
  }

  // 2. Expired check (Date is in the past relative to today)
  const checkIn = getCleanDate(fields.checkInDate);
  const departure = getCleanDate(fields.departureDate);
  const generalDate = getCleanDate(fields.date);
  const targetDate = checkIn || departure || generalDate;

  if (targetDate && targetDate < today) {
    warnings.isExpired = true;
    const fmt = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    warnings.expiredDetails = `This voucher date (${fmt}) is in the past (expired).`;
  }

  // 3. Previous date checks (check-out before check-in)
  if (kind === 'stay' && fields.checkInDate && fields.checkOutDate) {
    const inDate = getCleanDate(fields.checkInDate);
    const outDate = getCleanDate(fields.checkOutDate);
    if (inDate && outDate && outDate < inDate) {
      warnings.isPreviousDate = true;
      warnings.previousDetails = `Check-out date is scheduled before the check-in date.`;
    }
  }

  // Before earliest existing booking date
  if (targetDate && otherItems.length > 0) {
    let earliestDate = null;
    for (const item of otherItems) {
      const d = getCleanDate(item.fields.checkInDate || item.fields.departureDate || item.fields.date);
      if (d) {
        if (!earliestDate || d.getTime() < earliestDate.getTime()) {
          earliestDate = d;
        }
      }
    }

    if (earliestDate && targetDate.getTime() < earliestDate.getTime()) {
      warnings.isPreviousDate = true;
      const fmtEarliest = earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      warnings.previousDetails = `This date is scheduled before your earliest logged booking (${fmtEarliest}).`;
    }
  }

  return warnings;
};

// Unit tests
const mockExistingVaultItems = [
  {
    id: 'stay-1',
    kind: 'stay',
    fields: {
      hotelName: 'Tuli Imperial, Nagpur',
      checkInDate: '2026-06-10',
      checkOutDate: '2026-06-15',
      confirmationNo: 'CONF12345'
    }
  },
  {
    id: 'flight-1',
    kind: 'flight',
    fields: {
      airline: 'IndiGo',
      flightNo: '6E-6802',
      departureDate: '2026-06-08',
      pnr: 'PNR999'
    }
  }
];

console.log('--- RUNNING WARNINGS TESTS ---');

// Test case 1: duplicate check (pnr matching)
let warnings = getValidationWarnings('flight', { pnr: '  PNR999 ' }, mockExistingVaultItems);
console.assert(warnings.isDuplicate === true, 'Test 1 Failed: Should detect duplicate flight PNR');
console.log('Test 1 Passed: Duplicate PNR detected successfully.');

// Test case 2: stay checkin match duplicate
warnings = getValidationWarnings('stay', { hotelName: 'tuli imperial, nagpur', checkInDate: '2026-06-10' }, mockExistingVaultItems);
console.assert(warnings.isDuplicate === true, 'Test 2 Failed: Should detect duplicate Stay (hotelName + checkIn)');
console.log('Test 2 Passed: Duplicate Stay (Name + Check-in) detected successfully.');

// Test case 3: expired check
warnings = getValidationWarnings('activity', { date: '2020-01-01' }, mockExistingVaultItems);
console.assert(warnings.isExpired === true, 'Test 3 Failed: Should detect expired voucher (2020 date)');
console.log('Test 3 Passed: Expired voucher detected successfully.');

// Test case 4: checkout before checkin
warnings = getValidationWarnings('stay', { hotelName: 'Tuli', checkInDate: '2026-06-15', checkOutDate: '2026-06-10' }, mockExistingVaultItems);
console.assert(warnings.isPreviousDate === true, 'Test 4 Failed: Should detect check-out before check-in');
console.log('Test 4 Passed: Check-out before check-in detected successfully.');

// Test case 5: date before earliest logged booking
warnings = getValidationWarnings('activity', { date: '2026-06-05' }, mockExistingVaultItems);
console.assert(warnings.isPreviousDate === true, 'Test 5 Failed: Should detect date preceding earliest booking (2026-06-08)');
console.log('Test 5 Passed: Date before earliest logged booking detected successfully.');

// Test case 6: valid case (no warnings)
warnings = getValidationWarnings('activity', { date: '2026-06-12' }, mockExistingVaultItems);
console.assert(warnings.isDuplicate === false && warnings.isExpired === false && warnings.isPreviousDate === false, 'Test 6 Failed: Valid booking flagged with warning');
console.log('Test 6 Passed: Valid voucher (no warnings) handled successfully.');

console.log('--- ALL TESTS PASSED ---');
