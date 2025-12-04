const refreshStockPriceSnapshotSheet = () => {
  stockPriceSnapshotSheet.refresh();
}

const stockPriceSnapshotSheet = (() => {
  
  let memoised = null;
  const STOCK_PRICE_SNAPSHOT_SHEETNMAE = 'Stock Price Snapshot'
  
  const funcs = {
    getData: () => {
      if (memoised) {
        return memoised;
      }

      const helper = makeHelper(STOCK_PRICE_SNAPSHOT_SHEETNMAE);
      const [{ topLeftPosition }] = initMagicCoordinates(helper.getRange(1, 1, 1, 100), { topLeftPosition: 'topLeftPosition' });

      const data = helper.getRange(
        topLeftPosition.col, 
        topLeftPosition.row, 
        Math.max(helper.getLastColumn(), topLeftPosition.col), 
        Math.max(helper.getLastRow(), topLeftPosition.row)
      ).getValues();

      memoised = data;
      return data;
    },
    refresh: () => {
      const helper = makeHelper(STOCK_PRICE_SNAPSHOT_SHEETNMAE);
      const [{ topLeftPosition }] = initMagicCoordinates(helper.getRange(1, 1, 1, 100), { topLeftPosition: 'topLeftPosition' });      

      const earliestDate = getGlobalsSheet().getEarliest();
      const latestDate = getGlobalsSheet().getLatest();
      
      const symbols = getCombinedStockTransactionHistorySheet().getSymbols();
      
      const result = [];
      result.push(['', ...symbols]);
      result.push(['', ...symbols.map(symbol => stockPriceSnapshotBuilder.getCurrencyOf(symbol))]);

      for (let date = latestDate; date >= earliestDate; date = setTime(addDays(date, -1), 18)) {
        if (date.getDay() > 0 && date.getDay() < 6) {
          result.push([date, ...symbols.map(symbol => stockPriceSnapshotBuilder.getPriceOn(symbol, date))]);
        }
      }

      const resultSize = {
        rows: result.length,
        cols: result[0].length
      }
      
      helper.getRange(
        topLeftPosition.col, 
        topLeftPosition.row, 
        Math.max(helper.getLastColumn(), topLeftPosition.col), 
        Math.max(helper.getLastRow(), topLeftPosition.row)
      ).clearContent();

      if (helper.getMaxRows() < topLeftPosition.row + resultSize.rows) {
        helper.insertRows(helper.getMaxRows(), topLeftPosition.row + resultSize.rows - helper.getMaxRows());
      }

      if (helper.getMaxColumns() < topLeftPosition.col + resultSize.cols) {
        helper.insertColumns(helper.getMaxColumns(), topLeftPosition.col + resultSize.cols - helper.getMaxColumns());
      }

      helper.getRange(
        topLeftPosition.col, 
        topLeftPosition.row, 
        topLeftPosition.col + resultSize.cols - 1, 
        topLeftPosition.row + resultSize.rows - 1
      ).setValues(result);

      memoised = result;
    }
  }
  
  return funcs;

})();


