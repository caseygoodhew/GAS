const updateCombinedStockTransactionHistorySources = () => {

  const csthSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Combined Stock Transaction History');
  const csthColumns = initLabelledColumns(csthSheet, [
      'SOURCE_ID',
      'SOURCE_SHEET',
      'DATE',
      'TAX_YEAR',
      'ACTION',
      'SYMBOL',
      'QUANTITY',
      'SHARE_PRICE',
      'FEES',
      'AMOUNT',
      'CURRENCY'
    ]);

  const actions = {
    BUY: 'BUY',
    SELL: 'SELL',
    AWARD: 'AWARD',
    DIVIDEND: 'DIVIDEND',
    TAX: 'TAX',
    SPLIT: 'SPLIT',
    NONE: 'NONE'
  };

  const helper = makeHelper(csthSheet, csthColumns);

  const data = readCombinedStockTransactionHistorySources(csthColumns, {actions});

  const values = data.map(item => {
    return csthColumns.keys.reduce((array, key) => {
      array[csthColumns.colLabelToNumMap[key] - csthColumns.first] = item[key];
      return array;
    }, [])
  })

  if (csthSheet.getLastRow() > 2) {
    helper.getRange(csthColumns.first, 3, csthColumns.last, csthSheet.getLastRow()).clearContent();
  }
  helper.getRange(csthColumns.first, 3, csthColumns.last, 2 + values.length).setValues(values)

}