const cityTimezones = require('city-timezones');

console.log(cityTimezones.lookupViaCity('London'));
console.log(cityTimezones.lookupViaCity('london'));
console.log(cityTimezones.lookupViaCity('Toronto'));
console.log(cityTimezones.lookupViaCity('Tokyo'));
console.log(cityTimezones.lookupViaCity('Paris'));
console.log(cityTimezones.lookupViaCity('Sydney'));

