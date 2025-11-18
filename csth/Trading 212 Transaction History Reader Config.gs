const csthTrading212TransactionsDebug = () => {
  execCSTH();
}

function trading212TransactionHistoryReaderConfig(csthColumns, constants) {
  
  const sheetName = 'Trading 212 Transactions Raw';
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
    DIVIDEND,
    DEPOSIT,
    WITHDRAW,
    TAX,
  } = constants.actions;

  const UNKNOWN = 'UNKNOWN';
  const EMPTY = '';

  const assertIsNumberOrEmpty = (value, label) => {
    if (value === EMPTY) {
      return;
    }

    if (typeof value === 'number') {
      return;
    }

    throw new Error(`Expected "${label}" to be a number or empty, got (${value}) with type ${typeof value}`);
  }
  
  // Charles Schwab Transactions Raw
  return {
    sheetName,
    layout: {
      columns: [
        'EVENT ID',
        'Time',
        'Action',
        'Ticker',
        'No. of shares',
        'Price / share',
        'Currency (Price / share)',
        'Withholding tax',
        'Exchange rate',
        // 'Result' <- this column contains the capital gains on the SELL (and can be ignored)
        'Total',
        'Currency (Total)',
        'Stamp duty',
        'Currency (Stamp duty)', 
        'Stamp duty reserve tax',
        'Currency (Stamp duty reserve tax)', 
        'Ptm levy',
        'Currency (Ptm levy)',
      ].map(toKeyCase)
    },
    preProcess: [{
      // 1. If a witholding tax is ever non-zero, create a new line item for it with the action "Withholding tax"
      fn: data => {
        const withholdingTaxLines = data.filter(item => {
          const value = item[toKeyCase('Withholding Tax')];
          return typeof value === 'number' && value !== 0;
        })

        if (withholdingTaxLines.length > 0) {
          // This should probably create the line using a split function, but at the
          // time of implementation, there wasn't a use case for it
          throw new Error('Trading212: Withholdng Tax split not implemented');
        }

        return data;
      }
    }, {
      // 2. Expect that ['Currency (Stamp duty)', 'Currency (Stamp duty reserve tax)', 'Currency (Ptm levy)'] are always the same as 'Currency (Total)'
      fn: data => {
        const baseLabel = 'Currency (Total)';
        const expectSameLabels = ['Currency (Stamp duty)', 'Currency (Stamp duty reserve tax)', 'Currency (Ptm levy)']
        
        data.forEach(item => {
          const key = item[toKeyCase('EVENT ID')];
          const base = item[toKeyCase(baseLabel)];
          
          const expectSame = expectSameLabels.map(label => item[toKeyCase(label)]);
          
          expectSame.forEach((value, index) => {
            if (isEmpty(value)) { return; }

            if (base !== value) {
              throw new Error(`Trading212: Found unexpected currenty discrepency for ${key} between "${baseLabel}" (${base}) and "${expectSameLabels[index]}" (${value})`);
            }
          })
        });
        
        return data;
      }
    }, {
      // Rewrites the Amount of the transaction to be the quantity * stock_price.
      // Trading212 only applies fees/taxes on BUY transactions (from what I've seen) and 
      // the "Total" inclues the fees (cost of the transaction). Our standard is that the amount
      // should always be the taxable amount (i.e. excluding fees)
      fn: data => {

        const errors = [];

        const result = data.map(item => {
          const key = item[toKeyCase('EVENT ID')];
          const action = item[toKeyCase('Action')];
          const quantity = item[toKeyCase('No. of shares')];
          const price = item[toKeyCase('Price / share')];
          const exchange = item[toKeyCase('Exchange rate')];
          const statedAmount = item[toKeyCase('Total')];

          if (!isNumber(statedAmount)) {
            throw new Error(`"Total" does not appear to be a number (${key})`)
          }

          if (isNumber(quantity) || isNumber(price) || isNumber(exchange)) {
            if (!isNumber(quantity)) {
              throw new Error(`"No. of shares" does not appear to be a number (${key})`)
            }

            if (!isNumber(price)) {
              throw new Error(`"Price / share" does not appear to be a number (${key})`)
            }

            if (!isNumber(exchange)) {
              throw new Error(`"Exchange rate" does not appear to be a number (${key})`)
            }
          } else {
            return item;
          }

          let fees = item[toKeyCase('Withholding tax')] || 0;
          fees += item[toKeyCase('Stamp duty')] || 0;
          fees += item[toKeyCase('Stamp duty reserve tax')] || 0;
          fees += item[toKeyCase('Ptm levy')] || 0;

          const calculatedAmount = quantity * price / exchange;
          // is within 2p
          const within = 0.02;
          if (!equalsPlusOrMinus(Math.abs(calculatedAmount), Math.abs(statedAmount) - Math.abs(fees), within)) {
            errors.push(`(${key} ${action}) Difference between calculated & stated amounts (with fees) of ${Math.abs(calculatedAmount - Math.abs(statedAmount)) - fees}`);
          }

          return { ...item, [toKeyCase('Total')]: calculatedAmount }
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
      [DATE]: toKeyCase('Time'), 
      [TAX_YEAR]: {
        from: toKeyCase('Time'),
        fn: toTaxYear
      },
      [ACTION]: {
        from: toKeyCase('Action'),
        fn: (action) => {
          switch (action) {
            case 'Deposit':
              return DEPOSIT;
            
            case 'Market buy':
              return BUY;

            case 'Dividend (Dividend)':
              return DIVIDEND;

            case 'Market sell':
              return SELL;

            case 'Withdrawal':
              return WITHDRAW;

            case 'Withholding tax':
              return TAX;

            default:
              return UNKNOWN;
          }
        }
      },
      [SYMBOL]: toKeyCase('Ticker'),
      [QUANTITY]: toKeyCase('No. of shares'),
      [SHARE_PRICE]: {
        from: [
          toKeyCase('Price / share'), 
          toKeyCase('Exchange rate'), 
        ],
        fn: (price, exRate) => {
          
          assertIsNumberOrEmpty(price, "Price / Share");
          assertIsNumberOrEmpty(exRate, "Exchange Rate");
          
          if (price === EMPTY && exRate === EMPTY) {
            return EMPTY;
          }

          if (price === EMPTY || exRate === EMPTY) {
            throw new Error('Expected both "Price / Share" and "Exchange Rate" to be set, or not set. Encountered a mixed scenario')
          }
          
          return price / exRate
        }
      },
      [FEES]: {
        from: [
          toKeyCase('Stamp duty'),
          toKeyCase('Stamp duty reserve tax'),
          toKeyCase('Ptm levy'),
        ],
        fn: (stampDuty, stampDutyReserve, pmtLevy) => {
          assertIsNumberOrEmpty(stampDuty, "Stamp duty");
          assertIsNumberOrEmpty(stampDutyReserve, "Stamp duty reserve tax");
          assertIsNumberOrEmpty(pmtLevy, "Ptm levy");
          
          if (stampDuty === EMPTY && stampDutyReserve === EMPTY && pmtLevy === EMPTY) {
            return EMPTY;
          }

          return (stampDuty || 0) + (stampDutyReserve || 0) + (pmtLevy || 0);
        }
      },
      [AMOUNT]: {
        from: toKeyCase('Total'),
        fn: (amount) => {
          if (isNaN(amount)) {
            return amount;
          }

          return Math.abs(amount);
        }
      },
      [CURRENCY]: toKeyCase('Currency (Total)')
    },
    postProcess: [{
      // Managing Transactions that have been broken apart into small pieces (e.g. buy 1000 shares, but there are 10x 100 share transactions)
      fn: csthConsolidateDistributedActions(csthColumns, constants)
    }],
  };
}


