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

  let memoizedData = null;

  const funcs = {
    getSymbols: () => {
      
      const { SYMBOL } = funcs.getColumns();
      const data = funcs.getData();

      return Object.keys(data.reduce((acc, item) => {
        acc[item[SYMBOL]] = true;
        return acc;
      }, {})).filter(x => !!x.length).sort();
    },
    getHoldingQuantityAsOf: (symbol, date) => {
      const { DATE, ACTION, SYMBOL, QUANTITY } = funcs.getColumns();
      const { BUY, SELL, AWARD } = funcs.getConstants().actions;
      
      return funcs.getData().reduce((sum, item) => {
        if (item[SYMBOL] !== symbol || item[DATE] > date || !isNumber(item[QUANTITY])) {
          return sum;
        }

        switch (item[ACTION]) {
          case BUY:
          case AWARD:
            return sum + item[QUANTITY];
          
          case SELL:
            return sum - item[QUANTITY];

          default:
            return sum;
        }
      }, 0);
    },
    getData: () => {
      if (memoizedData) {
        return memoizedData;
      }
      
      const dataRange = helper.getRange(
        columns.first,
        topLeftPosition.row, 
        columns.last,
        sheet.getLastRow(),
      );

      const data = dataRange.getValues().map(row => {
        const result = columns.keys.reduce((acc, colLabel) => {
          acc[colLabel] = row[columns.colLabelToNumMap[colLabel] - topLeftPosition.col];
          return acc;
        }, {});

        return result;
      });

      memoizedData = data;
      return data;
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

      memoizedData = data;
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
