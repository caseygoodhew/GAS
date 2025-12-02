let memoizedCombinedStockTransactionHistorySheet;

const getCombinedStockTransactionHistorySheet = () => {
  
  if (memoizedCombinedStockTransactionHistorySheet != null) {
    return memoizedCombinedStockTransactionHistorySheet;
  }
  
  const CSTH_SHEET_NAME = 'Combined Stock Transaction History';

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CSTH_SHEET_NAME);
  
  const columns = initLabelledColumns(sheet, [
    'SOURCE_ID',
    'SOURCE_SHEET',
    'ACCOUNT',
    'EVENT_ID',
    'DATE',
    'TAX_YEAR',
    'ACTION',
    'ACTION_PARAM',
    'SYMBOL',
    'QUANTITY',
    'SHARE_PRICE',
    'FEES',
    'AMOUNT',
    'CURRENCY',
  ]);

  const helper = makeHelper(sheet, columns);

  const [{ topLeftPosition }] = initMagicCoordinates(helper.getRange(1, 1, 1, 100), { topLeftPosition: 'topLeftPosition' });

  const funcs = {
    getData: () => {
      const dataRange = helper.getRange(
        columns.first,
        topLeftPosition.row, 
        columns.last,
        sheet.getLastRow(),
      );

      return helper.getRowValues(dataRange).map(row => {
        const result = columns.keys.reduce((acc, colLabel) => {
          acc[colLabel] = row[columns.colLabelToNumMap[colLabel] - topLeftPosition.col];
          return acc;
        }, {});

        return result;
      });
    },
    setData: (data) => {
      /************************************************
       * Adjust the data
       */
      
      // converts the data set into a correctly shaped array
      const values = data.map(item => {
        return columns.keys.reduce((array, key) => {
          array[columns.colLabelToNumMap[key] - columns.first] = item[key];
          return array;
        }, [])
      })

      /************************************************
       * Prep and update the destination sheet
       */

      const existingDataRange = (sheet.getLastRow() >= topLeftPosition.row) 
        ? helper.getRange(columns.first, topLeftPosition.row, columns.last, sheet.getLastRow()) 
        : makeMockRange();

      // clear existing data (if any exists)
      existingDataRange.clearContent();
      
      // set the values (uses a new range)
      helper.getRange(columns.first, topLeftPosition.row, columns.last, topLeftPosition.row + values.length - 1).setValues(values);
    },
    getColumns: () => {
      return columns;
    },
    getConstants: () => ({
      actions: {
        BUY: 'BUY',
        SELL: 'SELL',
        AWARD: 'AWARD',
        DIVIDEND: 'DIVIDEND',
        TAX: 'TAX',
        SPLIT: 'SPLIT',
        WITHDRAW: 'WITHDRAW',
        DEPOSIT: 'DEPOSIT',
        MANUAL_SPLIT: 'MANUAL SPLIT',
        NONE: 'NONE'
      },
      accounts: {
        CHARLES_SCHWAB: 'CHARLES_SCHWAB',
        TRADING_212: 'TRADING_212'
      }
    })
  }

  memoizedCombinedStockTransactionHistorySheet = funcs;
  
  return funcs;
}
