const testCombinedStockTransactionHistorySheet = () => {
  const result = getCombinedStockTransactionHistorySheet().getHoldingQuantityAsOf('META', new Date(2025, 8, 11));

  const aaa = 0;
}

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
  const execMemoizeData = (data) => {
    const { SYMBOL } = funcs.getColumns();
    
    const bySymbol = {};
      
    data.forEach(item => {
        if (item[SYMBOL]) {
          bySymbol[item[SYMBOL]] = bySymbol[item[SYMBOL]] || [];
          bySymbol[item[SYMBOL]].push(item);
        }
    });
    
    memoizedData = {
      ...bySymbol,
      all: data,
      symbols: Object.keys(bySymbol).sort()
    };

    return memoizedData;
  }

  const funcs = {
    getSymbols: () => {
      return [...funcs.getData().symbols]
    },
    getAccountSymbolMap: () => {
      // This fn may not be optimized
      const {SYMBOL,ACCOUNT} = funcs.getColumns();
      const data = funcs.getData().all;

      const result = data.reduce((acc, item) => {
        if (!isString(item[SYMBOL]) || isEmpty(item[SYMBOL])) {
          return acc;
        }
        
        if (!isString(item[ACCOUNT]) || isEmpty(item[ACCOUNT])) {
          return acc;
        }

        acc[item[SYMBOL]] = acc[item[SYMBOL]] || [];
        acc[item[ACCOUNT]] = acc[item[ACCOUNT]] || [];

        if (!acc[item[SYMBOL]].includes(item[ACCOUNT])) {
          acc[item[SYMBOL]].push(item[ACCOUNT]);
        }

        if (!acc[item[ACCOUNT]].includes(item[SYMBOL])) {
          acc[item[ACCOUNT]].push(item[SYMBOL])
        }

        return acc;
      }, {});

      return Object.keys(result).sort().reduce((acc, key) => {
        acc[key] = result[key].sort();
        return acc;
      }, {});
    },
    
    getHoldingQuantityAsOf: (symbol, date) => {
      const { DATE, ACTION, QUANTITY } = funcs.getColumns();
      const { BUY, SELL, AWARD } = funcs.getConstants().actions;
      const data = funcs.getData()

      if (!data.symbols.includes(symbol)) {
        throw new Error(`Could not find data for symbol ${symbol}`)
      }
      
      return data[symbol].reduce((sum, item) => {
        if (item[DATE] > date || !isNumber(item[QUANTITY])) {
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

      return execMemoizeData(data);
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

      execMemoizeData(data);
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
