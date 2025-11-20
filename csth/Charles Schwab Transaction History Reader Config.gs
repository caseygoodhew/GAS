const csthCharlesSchwabTransactionsDebug = () => {
  execCSTH();
}

function charlesSchwabTransactionHistoryReaderConfig(csthColumns, constants) {
  
  const sheetName = 'Charles Schwab Transactions Raw';
  const csSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const csColumns = initLabelledColumns(csSheet, [
    'CS_EVENT_ID',
    'CS_DATE',
    'CS_ACTION',
    'CS_SYMBOL',
    'CS_QUANTITY',
    'CS_PRICE',
    'CS_FEES_COMM',
    'CS_AMOUNT'
  ]);

  const {
    CS_EVENT_ID,
    CS_DATE,
    CS_ACTION,
    CS_SYMBOL,
    CS_QUANTITY,
    CS_PRICE,
    CS_FEES_COMM,
    CS_AMOUNT
  } = csColumns;

  const {
    SOURCE_ID,
    SOURCE_SHEET,
    DATE,
    ACTION,
    SYMBOL,
    QUANTITY,
    SHARE_PRICE,
    FEES,
    AMOUNT,
    CURRENCY,
  } = csthColumns;

  const {
    BUY,
    SELL,
    AWARD,
    DIVIDEND,
    TAX,
    SPLIT,
    WITHDRAW,
    NONE,
  } = constants.actions;

  const UNKNOWN = 'UNKNOWN';
  
  // Charles Schwab Transactions Raw
  return {
    sheetName,
    layout: {
      columns: csColumns
    },
    preProcess: [{
      // check if dates are actual dates or something like 08/18/2025 as of 08/15/2025
      fn: data => {
        return data.map(item => {
          if (!isDate(item[CS_DATE])) {
            const re = /[0-9]{2,2}\/[0-9]{2,2}\/[0-9]{4,4} as of ([0-9]{2,2})\/([0-9]{2,2})\/([0-9]{4,4})/gm;
            const matches = re.exec(item[CS_DATE]);
            item[CS_DATE] = new Date(parseInt(matches[3]), parseInt(matches[1]) - 1, parseInt(matches[2]));
          }

          return item;
        });
      }
    }, {
      // Update symbols that have changed over time
      fn: data => {
        const changes = {
          'FB': 'META'
        };
        
        return data.map(item => {
          const symbol = item[CS_SYMBOL];
          if (changes[symbol]) {
            item[CS_SYMBOL] = changes[symbol];
          }
          return item;
        });
      }
    }, {
      // Update the award price and amount for RSUs  
      fn: data => {
        return data.map(item => {
          if (item[CS_ACTION] == 'Stock Plan Activity') {
            const date = item[CS_DATE];
            const symbol = item[CS_SYMBOL];
            const quantity = item[CS_QUANTITY];
            
            date.setDate(date.getDate() - 1);
            const price = readRate(symbol, date);

            item[CS_PRICE] = price;
            item[CS_AMOUNT] = price * quantity;
          }

          return item;
        })
      }
    }, {
      // Remove Stock Merger actions
      fn: data => {
        const actionsToDrop = ['Stock Merger'];
        return data.filter(item => !actionsToDrop.includes(item[CS_ACTION]));
      }
    }, {
      // Rewrites the Amount of the transaction to be the quantity * stock_price.
      // Charles Scwab only applies fees/taxes on SELL transactions (from what I've seen) and 
      // the "Amount" inclues the fees (cost of the transaction). Our standard is that the amount
      // should always be the taxable amount (i.e. excluding fees)
      fn: data => {

        const errors = [];

        const result = data.map(item => {
          const key = item[CS_EVENT_ID];
          const action = item[CS_ACTION];
          const quantity = item[CS_QUANTITY];
          const price = item[CS_PRICE];
          const statedAmount = item[CS_AMOUNT];

          if (isEmpty(statedAmount)) {
            return item;
          }

          if (!isNumber(statedAmount)) {
            throw new Error(`"Amount" does not appear to be a number (${key})`)
          }

          if (isNumber(quantity) || isNumber(price)) {
            if (!isNumber(quantity)) {
              throw new Error(`"Quantity" does not appear to be a number (${key})`)
            }

            if (!isNumber(price)) {
              throw new Error(`"Price" does not appear to be a number (${key})`)
            }
          } else {
            return item;
          }

          const fees = item[CS_FEES_COMM] || 0;

          const calculatedAmount = quantity * price;
          // is within 2 cents
          const within = 0.02;
          if (!equalsPlusOrMinus(Math.abs(calculatedAmount), Math.abs(statedAmount) + Math.abs(fees), within)) {
            errors.push(`(${key} ${action}) Difference between calculated & stated amounts (with fees) of ${Math.abs(calculatedAmount - Math.abs(statedAmount)) + fees}`);
          } 

          return { ...item, [CS_AMOUNT]: calculatedAmount }
        });

        if (errors.length) {
          throw new Error(errors.join('\n'))
        }

        return result;
      },
    }],
    process: {
      [SOURCE_ID]: CS_EVENT_ID,
      [SOURCE_SHEET]: {
        fn: () => sheetName,
      },
      [DATE]: CS_DATE, 
      [ACTION]: {
        from: CS_ACTION,
        fn: (action) => {
          switch (action) {
            case 'Buy':
            case 'Reinvest Shares':
              return BUY;

            case 'Sell':
              return SELL;

            case 'Stock Plan Activity':
              return AWARD;

            case 'Stock Split':
              return SPLIT;

            case 'NRA Tax Adj':
              return TAX;

            case 'Qualified Dividend':
            case 'Qual Div Reinvest':
              return DIVIDEND;
            
            case 'MoneyLink Transfer':
              return WITHDRAW;

            case 'Stock Plan Activity':
            case 'Credit Interest':
            case 'Special Qual Div':
            case 'Adjustment':
              return NONE;

            default:
              return UNKNOWN;
          }
        }
      },
      [SYMBOL]: CS_SYMBOL,
      [QUANTITY]: CS_QUANTITY,
      [SHARE_PRICE]: CS_PRICE,
      [FEES]: CS_FEES_COMM,
      [AMOUNT]: {
        from: CS_AMOUNT,
        fn: (amount) => {
          if (isNaN(amount)) {
            return amount;
          }

          return Math.abs(amount);
        }
      },
      [CURRENCY]: {
        from: CS_AMOUNT,
        fn: () => 'USD'
      }
    },
    postProcess: [{
      // Managing Stock Split
      fn: csthConsolidateMarketSplits(csthColumns, constants)
    }],
  };
}


