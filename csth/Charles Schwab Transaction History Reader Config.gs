const csthCharlesSchwabTransactionsDebug = () => {
  execCSTH();
}

function charlesSchwabTransactionHistoryReaderConfig(csthColumns, constants) {
  
  const sheetName = 'Charles Schwab Transactions Raw';
  const toKeyCase = value => String(value).replace(/ /g, '_').toUpperCase();

  const {
    SOURCE_ID,
    SOURCE_SHEET,
    DATE,
    TAX_YEAR,
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
      columns: [
        'EVENT ID',
        'Date',
        'Action',
        'Symbol',
        'Quantity',
        'Price',
        'Fees & Comm',
        'Amount'
      ].map(toKeyCase)
    },
    preProcess: [{
      // check if dates are actual dates or something like 08/18/2025 as of 08/15/2025
      fn: data => {
        return data.map(item => {
          const key = toKeyCase('Date');
          
          if (!isDate(item[key])) {
            const re = /[0-9]{2,2}\/[0-9]{2,2}\/[0-9]{4,4} as of ([0-9]{2,2})\/([0-9]{2,2})\/([0-9]{4,4})/gm;
            const matches = re.exec(item[key]);
            item[key] = new Date(parseInt(matches[3]), parseInt(matches[1]) - 1, parseInt(matches[2]));
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
          const symbol = item[toKeyCase('Symbol')];
          if (changes[symbol]) {
            item[toKeyCase('Symbol')] = changes[symbol];
          }
          return item;
        });
      }
    }, {
      // Update the award price and amount for RSUs  
      fn: data => {
        return data.map(item => {
          if (item[toKeyCase('Action')] == 'Stock Plan Activity') {
            const date = item[toKeyCase('Date')];
            const symbol = item[toKeyCase('Symbol')];
            const quantity = item[toKeyCase('Quantity')];
            
            date.setDate(date.getDate() - 1);
            const price = readRate(symbol, date);

            item[toKeyCase('Price')] = price;
            item[toKeyCase('Amount')] = price * quantity;
          }

          return item;
        })
      }
    }, {
      // Remove Stock Merger actions
      fn: data => {
        const actionsToDrop = ['Stock Merger'];
        return data.filter(item => !actionsToDrop.includes(item[toKeyCase('Action')]));
      }
    }, {
      // Rewrites the Amount of the transaction to be the quantity * stock_price.
      // Charles Scwab only applies fees/taxes on SELL transactions (from what I've seen) and 
      // the "Amount" inclues the fees (cost of the transaction). Our standard is that the amount
      // should always be the taxable amount (i.e. excluding fees)
      fn: data => {

        const errors = [];

        const result = data.map(item => {
          const key = item[toKeyCase('EVENT ID')];
          const action = item[toKeyCase('Action')];
          const quantity = item[toKeyCase('Quantity')];
          const price = item[toKeyCase('Price')];
          const exchange = item[toKeyCase('Exchange rate')];
          const statedAmount = item[toKeyCase('Amount')];

          if (isEmpty(statedAmount)) {
            return item;
          }

          if (!isNumber(statedAmount)) {
            throw new Error(`"Amount" does not appear to be a number (${key})`)
          }

          if (isNumber(quantity) || isNumber(price) || isNumber(exchange)) {
            if (!isNumber(quantity)) {
              throw new Error(`"Quantity" does not appear to be a number (${key})`)
            }

            if (!isNumber(price)) {
              throw new Error(`"Price" does not appear to be a number (${key})`)
            }
          } else {
            return item;
          }

          const fees = item[toKeyCase('Fees & Comm')] || 0;

          const calculatedAmount = quantity * price;
          // is within 2 cents
          const within = 0.02;
          if (!equalsPlusOrMinus(Math.abs(calculatedAmount), Math.abs(statedAmount) + Math.abs(fees), within)) {
            errors.push(`(${key} ${action}) Difference between calculated & stated amounts (with fees) of ${Math.abs(calculatedAmount - Math.abs(statedAmount)) + fees}`);
          } 

          return { ...item, [toKeyCase('Amount')]: calculatedAmount }
        });

        if (errors.length) {
          throw new Error(errors.join('\n'))
        }

        return result;
      },
    }],
    process: {
      [SOURCE_ID]: toKeyCase('EVENT ID'),
      [SOURCE_SHEET]: {
        fn: () => sheetName,
      },
      [DATE]: toKeyCase('Date'), 
      [TAX_YEAR]: {
        from: toKeyCase('Date'),
        fn: toTaxYear
      },
      [ACTION]: {
        from: toKeyCase('Action'),
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
      [SYMBOL]: toKeyCase('Symbol'),
      [QUANTITY]: toKeyCase('Quantity'),
      [SHARE_PRICE]: toKeyCase('Price'),
      [FEES]: toKeyCase('Fees & Comm'),
      [AMOUNT]: {
        from: toKeyCase('Amount'),
        fn: (amount) => {
          if (isNaN(amount)) {
            return amount;
          }

          return Math.abs(amount);
        }
      },
      [CURRENCY]: {
        from: toKeyCase('Amount'),
        fn: () => 'USD'
      }
    },
    postProcess: [{
      // Managing Stock Split
      fn: csthConsolidateMarketSplits(csthColumns, constants)
    }],
  };
}


