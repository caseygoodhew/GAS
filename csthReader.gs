const readCombinedStockTransactionHistorySources = () => {

  const exec = () => {
    
    const csthSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Combined Stock Transaction History');
    const csthColKeys = getCombinedStockTransactionHistoryColumnKeys()
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
      SPLIT: 'SPLIT',
      NONE: 'NONE',
      UNKNOWN: 'UNKNOWN'
    }
    
    const csData = readStockHistory(
      charlesSchwabTransactionHistoryReaderConfig(csthColumns, { actions })
    );

    const t212Data = [];
    
    return [].concat(csData, t212Data);
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

  const readStockHistory = ({ sheetName, layout, preProcess, process, postProcess }) => {
    
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

    let data = helper.getRowValues(dataRange).map(row => {
      return layout.columns.reduce((acc, colLabel) => {
        acc[colLabel] = row[columns.colLabelToNumMap[colLabel] - 1];
        return acc;
      }, {});
    });
    
    /***********************************
     * RUN PRE-PROCESSORS
     **********************************/
    data = (preProcess || []).reduce((data, {fn}) => fn(data), data);
    
    /***********************************
     * RUN PROCESSORS
     **********************************/
    
    processKeys = Object.keys(process);
    data = data.map(item => {
      return processKeys.reduce((result, key) => {
        const config = process[key];

        // SOURCE_ID_COL: toKeyCase('EVENT ID'),
        if (typeof config === 'string') {
          result[key] = item[config];
          return result;
        } 

        if (Object.prototype.toString.call(config) !== '[object Object]') {
          throw new Error(`Expected value of process.${key} to either be a String (key) or a config object`)
        }

        // SOURCE_SHEET_COL: {
        //   fn: () => sheetName,
        // },
        if (config.from === undefined) {
          result[key] = config.fn(item);
        
        // TAX_YEAR_COL: {
        //   from: toKeyCase('Date'),
        //   fn: (date) => {} // calc the tax year
        // },
        } else {
          result[key] = config.fn(item[config.from], item);
        }

        return result;

      }, {})
    })

    /***********************************
     * RUN POST-PROCESSORS
     **********************************/
    data = (postProcess || []).reduce((data, {fn}) => fn(data), data);
    
    return data;
  }

  return exec();
}
