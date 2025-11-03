
function charlesSchwabTransactionHistoryReaderConfig() {
  
  const {
    SOURCE_ID_COL,
    SOURCE_SHEET_COL,
    DATE_COL,
    TAX_YEAR_COL,
    ACTION_COL,
    SYMBOL_COL,
    QUANTITY_COL,
    SHARE_PRICE_COL,
    FEES_COL,
    AMOUNT_COL,
    CURRENCY_COL,
  } = getCombinedStockTransactionHistoryColumnKeys();
  
  // Charles Schwab Transactions Raw
  return {
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
    }, {
      // Managing Stock Split
      // I had a total of 30 NVDA shares when the stock split. I was awarded an additional 270 shares. This gives a total of 300 shares against my original 30 shares, so 10:1 split. I need to multiply my old shares by 10 and divide their respective purchase prices by 10. Then I can remove the Stock Split line.
    }, {
      // Remove Stock Merger actions
    }],
    process: {
      SOURCE_ID_COL: toKeyCase('EVENT ID'),
      SOURCE_SHEET_COL: {
        fn: () => sheetName,
      },
      DATE_COL: toKeyCase('Date'), 
      TAX_YEAR_COL: {
        from: toKeyCase('Date'),
        fn: (date) => {} // calc the tax year
      },
      ACTION_COL: {
        from: toKeyCase('Action'),
        fn: (action) => {
          switch (action) {
            case 'Buy':
            case 'Reinvest Shares':
              return 'BUY';

            case 'Sell':
              return 'SELL';

            case 'Stock Plan Activity':
              return 'AWARD';

            case 'NRA Tax Adj':
            case 'Qualified Dividend':
            case 'Qual Div Reinvest':
            case 'Stock Plan Activity':
            case 'MoneyLink Transfer':
            case 'Credit Interest':
            case 'Special Qual Div':
            case 'Adjustment':
              return 'NONE';

            default:
              return 'UNKNOWN';
          }
        }
      },
      SYMBOL_COL: toKeyCase('Symbol'),
      QUANTITY_COL: toKeyCase('Quantity'),
      SHARE_PRICE_COL: toKeyCase('Price'),
      FEES_COL: toKeyCase('Fees & Comm'),
      AMOUNT_COL: {
        from: toKeyCase('Amount'),
        fn: (amount) => {
          if (isNaN(amount)) {
            return amount;
          }

          return Math.abs(amount);
        }
      },
      CURRENCY_COL: {
        from: toKeyCase('Amount'),
        fn: () => 'USD'
      }
    },
    postProcess: [{
      // Update the award price and amount for RSUs  
    }, {
      // Ensure tha there aren't any Actions mapped to 'UNKNOWN'
    }],
  };
}

const toKeyCase = value => String(value).replace(/ /g, '_').toUpperCase();
