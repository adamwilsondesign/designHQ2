import cityTimezones from 'city-timezones';

export const formatUSD = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const guessTimezone = (location: string) => {
  if (!location) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Try to extract city name (assuming format like "City, Country" or just "City")
  const cityMatch = location.split(',')[0].trim();
  
  const cityData = cityTimezones.lookupViaCity(cityMatch);
  if (cityData && cityData.length > 0) {
    // Sort by population descending to get the most likely city
    cityData.sort((a, b) => (b.pop || 0) - (a.pop || 0));
    return cityData[0].timezone;
  }

  const loc = location.toLowerCase();
  if (loc.includes('new york') || loc.includes('toronto') || loc.includes('est') || loc.includes('edt') || loc.includes('miami') || loc.includes('atlanta')) return 'America/New_York';
  if (loc.includes('london') || loc.includes('uk') || loc.includes('britain') || loc.includes('england')) return 'Europe/London';
  if (loc.includes('california') || loc.includes('los angeles') || loc.includes('sf') || loc.includes('pst') || loc.includes('pdt') || loc.includes('seattle') || loc.includes('vancouver')) return 'America/Los_Angeles';
  if (loc.includes('chicago') || loc.includes('cst') || loc.includes('cdt') || loc.includes('texas') || loc.includes('dallas')) return 'America/Chicago';
  if (loc.includes('paris') || loc.includes('france') || loc.includes('berlin') || loc.includes('germany') || loc.includes('amsterdam') || loc.includes('netherlands') || loc.includes('europe') || loc.includes('spain') || loc.includes('italy')) return 'Europe/Paris';
  if (loc.includes('tokyo') || loc.includes('japan')) return 'Asia/Tokyo';
  if (loc.includes('sydney') || loc.includes('australia') || loc.includes('melbourne')) return 'Australia/Sydney';
  if (loc.includes('india') || loc.includes('ist') || loc.includes('delhi') || loc.includes('mumbai') || loc.includes('bangalore')) return 'Asia/Kolkata';
  if (loc.includes('brazil') || loc.includes('sao paulo') || loc.includes('rio')) return 'America/Sao_Paulo';
  if (loc.includes('dubai') || loc.includes('uae')) return 'Asia/Dubai';
  if (loc.includes('singapore')) return 'Asia/Singapore';
  if (loc.includes('china') || loc.includes('beijing') || loc.includes('shanghai')) return 'Asia/Shanghai';
  if (loc.includes('mexico')) return 'America/Mexico_City';
  if (loc.includes('argentina') || loc.includes('buenos aires')) return 'America/Argentina/Buenos_Aires';
  if (loc.includes('south africa') || loc.includes('johannesburg') || loc.includes('cape town')) return 'Africa/Johannesburg';
  
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};
