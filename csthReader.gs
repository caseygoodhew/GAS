function testFunction() {
  const config = charlesSchwabTransactionHistoryReaderConfig();
  const sheetName = 'Charles Schwab Transactions Raw';

  readStockHistory(sheetName, config);
}

const getCombinedStockTransactionHistoryColumnKeys = () => ({
  SOURCE_ID_COL: 'SOURCE_ID',
  SOURCE_SHEET_COL: 'SOURCE_SHEET',
  DATE_COL: 'DATE',
  TAX_YEAR_COL: 'TAX_YEAR',
  ACTION_COL: 'ACTION',
  SYMBOL_COL: 'SYMBOL',
  QUANTITY_COL: 'QUANTITY',
  SHARE_PRICE_COL: 'SHARE_PRICE',
  FEES_COL: 'FEES',
  AMOUNT_COL: 'AMOUNT',
  CURRENCY_COL: 'CURRENCY'
})

const readStockHistory = (sheetName, { layout, preProcess, process, postProcess }) => {
  
  /***********************************
   * SETUP
   **********************************/
  // we assume that the first data happens on row 3 (HEADING, heading, data...)
  const firstDataRow = 3;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const columns = initLabelledColumns(sheet, layout.columns);
  const helper = makeHelper(sheet, columns)

  /***********************************
   * CONVERT DATA TO JSON
   **********************************/
  const dataRange = helper.getRange(
    columns.first,
    firstDataRow, 
    columns.last,
    sheet.getLastRow(),
  );

  const data = helper.getRowValues(dataRange).map(row => {
    return layout.columns.reduce((acc, colLabel) => {
      acc[colLabel] = row[columns.colLabelToNumMap[colLabel] - 1];
      return acc;
    }, {});
  });
  
  /***********************************
   * RUN PRE-PROCESSORS
   **********************************/
  
  /***********************************
   * RUN PROCESSORS
   **********************************/
  
  /***********************************
   * RUN POST-PROCESSORS
   **********************************/
  
}


