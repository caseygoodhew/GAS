let exchangeRatesReaderMemoization = null;

const testExchangeRateReader = () => {
  
  const date1 = new Date(2022, 0, 3);
  const date2 = setTime(date1, 12);

  const result = [
    exchangeRatesReader().getRateOn('USD', 'USD', date1),
    exchangeRatesReader().getRateOn('USD', 'USD', date2),
    exchangeRatesReader().getRateOn('GBP', 'GBP', date1),
    exchangeRatesReader().getRateOn('GBP', 'GBP', date2),
    
    exchangeRatesReader().getRateOn('USD', 'GBP', date1),
    exchangeRatesReader().getRateOn('USD', 'GBP', date2),
    exchangeRatesReader().getRateOn('GBP', 'USD', date1),
    exchangeRatesReader().getRateOn('GBP', 'USD', date2),
  ];

  const expectedRates = [
    1,
    1,
    1,
    1,

    0.73952,
    0.74166,
    1.35209,
	  1.34808,
  ];

  const errorCount = expectedRates.reduce((acc, expected, index) => {
    if (expected !== result[index]) {
      console.error(`Expected index ${index} to be ${expected}, got ${result[index]}`);
      acc++;
    }
    return acc;
  }, 0);

  if (errorCount === 0) {
    console.log(`All rates returned as expected`)
  }
}

const exchangeRatesReader = () => {

  if (exchangeRatesReaderMemoization != null) {
    return exchangeRatesReaderMemoization;
  }
  
  let memoization = {};

  const makeKey = (fromCur, toCur) => `${fromCur}${toCur}`;

  const readUSDGBP = () => {
    const SHEET_NAME = 'USDGBP';
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const columns = initLabelledColumns(sheet, ['UG_DATE',	'UG_RATE',	'GU_DATE',	'GU_RATE']);
    const { UG_DATE,	UG_RATE,	GU_DATE,	GU_RATE } = columns;
    const helper = makeHelper(sheet, columns);
    const [{ firstRow }] = initMagicCoordinates(helper.getRange(1, 1, 100, 2), { firstRow: 'firstRow' });      

    const values = helper.getRange(columns.first, firstRow.row, columns.last, helper.getLastRow()).getValues();

    const colIndexOf = key => columns.colLabelToNumMap[key] - columns.first;

    const USDGBP = [];
    const GBPUSD = [];

    values.forEach(row => {
      if (isDate(row[colIndexOf(UG_DATE)])) {
        USDGBP.push({
          date: setTime(row[colIndexOf(UG_DATE)], 12),
          rate: row[colIndexOf(UG_RATE)]
        });
      }
      
      if (isDate(row[colIndexOf(GU_DATE)])) {
        GBPUSD.push({
          date: setTime(row[colIndexOf(GU_DATE)], 12),
          rate: row[colIndexOf(GU_RATE)]
        });
      }
    });

    return { USDGBP, GBPUSD };
  }

  const memoisedFastFind = {};
  const fastFindAsOf = (fromCur, toCur, date) => {
    const key = makeKey(fromCur, toCur);

    if (!memoisedFastFind[key]) {
      const history = funcs.getHistoryOf(fromCur, toCur);
      memoisedFastFind[key] = initFastFind(history, 'ASC');
    }
    return memoisedFastFind[key](date);
  }

  const funcs = {
    getHistoryOf: (fromCur, toCur) => {
      const key = makeKey(fromCur, toCur);
      
      if (memoization[key]) {
        return memoization[key];
      }

      switch (key) {
        case 'USDUSD':
        case 'GBPGBP':
          memoization[key] = [{
            date: setTime(addDays(getGlobalsSheet().getEarliest(), -1), 12),
            rate: 1
          }];
          break;

        case 'USDGBP':
        case 'GDPUSD':
          const result = readUSDGBP();
          
          memoization = Object.keys(result).reduce((acc, key) => {
            acc[key] = result[key];
            return acc;
          }, memoization);
          
          break;
      
        default:
          throw new Error(`Exchange rate reader not implemented for ${key}`)
      }

      return memoization[key];
    },

    getRateOn: (romCur, toCur, date) => {
      return funcs.getRecordOn(romCur, toCur, date).rate;
    },

    getRecordOn: (fromCur, toCur, date) => {
      if (date > new Date()) {
        throw new Error(`Cannot get stock price record for a future date (${date})`);
      }
      
      const result = fastFindAsOf(fromCur, toCur, date);
      
      if (result == null) {
        throw new Error(`Cannot get exchange rate record from ${fromCur} to ${toCur} as (${date}) is older than the oldest record`)
      }
      
      return {
        from: fromCur,
        to: toCur,
        date: new Date(result.date),
        rate: result.rate
      }
    }
  }

  exchangeRatesReaderMemoization = funcs;
  return funcs;

};