'use strict';

const { checkItineraryConflicts } = require('../lib/itinerary-checker');

const mockItems = [
  {
    id: '1',
    trip_id: 'trip1',
    date: '2026-06-05',
    time: '12:00:00',
    type: 'flight',
    title: 'Flight A'
  },
  {
    id: '2',
    trip_id: 'trip1',
    date: '2026-06-05',
    time: '13:00:00',
    type: 'stay',
    title: 'Hotel B'
  },
  {
    id: '3',
    trip_id: 'trip1',
    date: '2026-06-05',
    time: '15:30:00',
    type: 'activity',
    title: 'Scuba Diving'
  }
];

console.log('Running Itinerary Checker test...');
const conflicts = checkItineraryConflicts(mockItems);

console.log('Found conflicts count:', conflicts.length);
if (conflicts.length === 1 && conflicts[0].gapMinutes === 60) {
  console.log('SUCCESS: Correctly flagged conflict of 60 mins between Flight A and Hotel B.');
} else {
  console.error('FAILED: Conflict count or details mismatch.', conflicts);
  process.exit(1);
}
