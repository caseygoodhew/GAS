const testStockPriceReader = () => {
  const date = new Date(2024, 1, 1);
  const symbol = 'META';
  const price = stockPriceReader.getPriceOn(symbol, date);
  const expectedPrice = 390.14;
  if (price !== expectedPrice) {
    throw new Error(`Expected price to be ${expectedPrice}, got ${price}`)
  }
  
  console.log(`${symbol} ${price} on ${date}`)  
}

const initStockPriceReader = (useSnapshot) => {

  let memoization = {};

  const getHistoryFROMSnapshot = (symbol) => {
    const rawData = stockPriceSnapshotSheet.getData();

    const symbols = rawData.splice(0, 1)[0];
    const currencies = rawData.splice(0, 1)[0];
    const [map, array] = symbols.reduce((acc, symbol, index) => {
      
      const data = [];
      if (symbol) {
        const store = { symbol, currency: currencies[index], data };
        acc[0][symbol] = store;
      }
      acc[1].push(data);

      return acc;

    }, [{}, []]);

    rawData.forEach(row => {
      const date = row[0];
      for (let i = 1; i < row.length; i++) {
        array[i].push({ date, price: row[i] });
      }
    })

    // This assumes that the snapshot ALWAYS has all symbols (which is probably ok here as the snapshot should be consistently used)
    memoization = map;
    return map[symbol];
  }
  
  const getHistoryFORSnapshot = (symbol) => {
    const helper = makeHelper(symbol);
    const [locationOf] = initMagicCoordinates(helper.getRange(1, 1, 100, 1), { 
      firstDate: 'firstDate',
      financeFormula: 'financeFormula',
      currency: 'currency'
    });

    const currency = helper.getRange(locationOf.currency.col, locationOf.currency.row).getValue();

    const values = helper.getRange("A", locationOf.firstDate.row, "C", helper.getLastRow()).getValues();

    const data = values.filter(row => isDate(row[0])).map(([date, _, price]) => ({ date, price }));
    
    const maxDate = data.reduce((mostRecent, item) => {
      if (item.date > mostRecent) {
        return item.date;
      }
      return mostRecent;
    }, new Date(1999, 0, 1));
    
    if (getDaysBetweenDates(new Date(), maxDate) > 7) {
      throw new Error(`Most recent stock price record for ${symbol} is more than a week out of date. Please refresh the dates (${getGlobalsSheet().getSheetName()} sheet)`)
    }
    
    return { symbol, currency, data };
  }

  const memoisedFastFind = {};
  const fastFindAsOf = (symbol, date) => {
    if (!memoisedFastFind[symbol]) {
      const history = funcs.getHistoryOf(symbol);
      memoisedFastFind[symbol] = initFastFind(history.data, 'DESC');
    }
    return memoisedFastFind[symbol](date);
  }

  const funcs = {
    getHistoryOfMany: (...symbols) => {
      return symbols.reduce((acc, symbol) => {
       acc[symbol] = funcs.getHistoryOf(symbol);
       return acc;
      }, {});
    },

    getHistoryOf: (symbol) => {
      if (memoization[symbol]) {
        return memoization[symbol];
      }

      memoization[symbol] = useSnapshot ? getHistoryFROMSnapshot(symbol) : getHistoryFORSnapshot(symbol);
      
      return memoization[symbol];
    },

    getPriceOn: (symbol, date) => {
      return funcs.getRecordOn(symbol, date).price;
    },

    getRecordOn: (symbol, date) => {
      if (date > new Date()) {
        throw new Error(`Cannot get stock price record for a future date (${date})`);
      }
      
      const closest = fastFindAsOf(symbol, date);
      
      if (closest == null) {
        throw new Error(`Cannot get stock price record for ${symbol} as (${date}) is older than the oldest record`)
      }
      
      return {
        symbol,
        date: new Date(closest.date),
        price: closest.price,
        currency: funcs.getCurrencyOf(symbol)
      }
    },

    getCurrencyOf: (symbol) => {
      const history = funcs.getHistoryOf(symbol);
      return history.currency;
    }
  }

  return funcs;

};

const stockPriceReader = (() => {
  return initStockPriceReader(true);
})();

const stockPriceSnapshotBuilder = (() => {
  return initStockPriceReader(false);
})();