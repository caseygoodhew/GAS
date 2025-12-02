const stockPriceReader = (() => {

  const memoization = {};

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

      const helper = makeHelper(symbol);
      const [locationOf] = initMagicCoordinates(helper.getRange(1, 1, 100, 1), { 
        firstDate: 'firstDate',
        financeFormula: 'financeFormula',
        currency: 'currency'
      });

      const currency = helper.getRange(locationOf.currency.col, locationOf.currency.row).getValue();

      const values = helper.getRange("A", locationOf.firstDate.row, "C", helper.getLastRow()).getValues();

      const data = values.filter(row => isDate(row[0])).map(([date, _, price]) => ({ date, price }));
      memoization[symbol] = { symbol, currency, data};
      return memoization[symbol];
    },
  }

  return funcs;

})();

const refreshStockPriceSnapshotSheet = () => {
  
  const STOCK_PRICE_SNAPSHOT_SHEETNMAE = 'Stock Price Snapshot'
  
  const exec = () => {
    const helper = makeHelper(STOCK_PRICE_SNAPSHOT_SHEETNMAE);
    const [{ topLeftPosition }] = initMagicCoordinates(helper.getRange(1, 1), { topLeftPosition: 'topLeftPosition' });

    const earliestDate = getGlobalsSheet().getEarliest();
    const latestDate = getGlobalsSheet().getLatest();
    
    const csthSheet = getCombinedStockTransactionHistorySheet();
    const {
      SYMBOL
    } = csthSheet.getColumns();

    const stockData = csthSheet.getData();
    const symbols = Object.keys(stockData.reduce((acc, item) => {
      acc[item[SYMBOL]] = true;
      return acc;
    }, {})).filter(x => !!x.length).sort();
    
    const allRates = stockPriceReader.getHistoryOfMany(...symbols);
    
    
  
  }
  
  return exec();
};


