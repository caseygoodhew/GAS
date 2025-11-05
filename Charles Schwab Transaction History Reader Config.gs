const testFunction = () => {
  readCombinedStockTransactionHistorySources();
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
            
            case 'Stock Plan Activity':
            case 'MoneyLink Transfer':
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
      fn: csthConsolidateStockSplits(csthColumns, constants)
    }],
  };
}


