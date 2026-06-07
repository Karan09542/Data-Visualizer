const { isPast, isToday } = require('date-fns');

const d1 = new Date('2026-06-05');
console.log('2026-06-05:', isPast(d1), isToday(d1));

const d2 = new Date('2026-06-06');
console.log('2026-06-06:', isPast(d2), isToday(d2));
