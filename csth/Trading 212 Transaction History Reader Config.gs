const csthTrading212TransactionsDebug = () => {
  execCSTH();
}

function trading212TransactionHistoryReaderConfig(csthColumns, constants) {
  
  const sheetName = 'Trading 212 Transactions Raw';
  const t212Sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const t212Columns = initLabelledColumns(t212Sheet, [
    'T212_EVENT_ID',
    'T212_ACTION',
    'T212_TIME',
    'T212_TICKER',
    'T212_NO_OF_SHARES',
    'T212_PRICE_SHARE',
    'T212_EXCHANGE_RATE',
    'T212_TOTAL',
    // T212_RESULT,  <- this column contains the capital gains on the SELL (and can be ignored)
    
    'T212_WITHHOLDING_TAX',
    'T212_STAMP_DUTY',
    'T212_STAMP_DUTY_RESERVE_TAX',
    'T212_PTM_LEVY',
    
    'T212_CURRENCY_PRICE_SHARE',
    'T212_CURRENCY_TOTAL',
    'T212_CURRENCY_WITHHOLDING_TAX',
    'T212_CURRENCY_STAMP_DUTY',
    'T212_CURRENCY_STAMP_DUTY_RESERVE_TAX',
    'T212_CURRENCY_PTM_LEVY',
  ]);

  const {
    T212_EVENT_ID,
    T212_ACTION,
    T212_TIME,
    T212_TICKER,
    T212_NO_OF_SHARES,
    T212_PRICE_SHARE,
    T212_EXCHANGE_RATE,
    T212_TOTAL,
    
    T212_WITHHOLDING_TAX,
    T212_STAMP_DUTY,
    T212_STAMP_DUTY_RESERVE_TAX,
    T212_PTM_LEVY,
    
    T212_CURRENCY_TOTAL,
    T212_CURRENCY_WITHHOLDING_TAX,
    T212_CURRENCY_STAMP_DUTY,
    T212_CURRENCY_STAMP_DUTY_RESERVE_TAX,
    T212_CURRENCY_PTM_LEVY,
  } = t212Columns;

  const {
    SOURCE_ID,
    DATE,
    ACTION,
    SYMBOL,
    QUANTITY,
    SHARE_PRICE,
    FEES,
    AMOUNT,
    CURRENCY,
  } = csthColumns;

  if (!isString(ACTION)) {
    throw new Error(`Are you sure that you passed the correct parameters?`)
  }

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
    if (isEmpty(value)) {
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
      columns: t212Columns
    },
    preProcess: [{
      // 1. If a witholding tax is ever non-zero, create a new line item for it with the action "Withholding tax"
      fn: data => {
        const withholdingTaxLines = data.filter(item => {
          const value = item[T212_WITHHOLDING_TAX];
          return isNumber(value) && value !== 0;
        })

        // Note that Withholding Tax is GBX, so any value would need to be converted
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
        const baseLabel = T212_CURRENCY_TOTAL;
        const expectSameLabels = [T212_CURRENCY_STAMP_DUTY, T212_CURRENCY_STAMP_DUTY_RESERVE_TAX, T212_CURRENCY_PTM_LEVY]
        
        data.forEach(item => {
          const key = item[T212_EVENT_ID];
          const base = item[baseLabel];
          
          const expectSame = expectSameLabels.map(label => item[label]);
          
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
          const key = item[T212_EVENT_ID];
          const action = item[T212_ACTION];
          const quantity = item[T212_NO_OF_SHARES];
          const price = item[T212_PRICE_SHARE];
          const exchange = item[T212_EXCHANGE_RATE];
          const statedAmount = item[T212_TOTAL];

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

          // Note that we can't just add Witholding Tax because it's in GBX - currently, it's always 0 (and there's a check for this)
          let fees = 0; // item[T212_WITHHOLDING_TAX] || 0; 
          fees += item[T212_STAMP_DUTY] || 0;
          fees += item[T212_STAMP_DUTY_RESERVE_TAX] || 0;
          fees += item[T212_PTM_LEVY] || 0;

          const calculatedAmount = quantity * price / exchange;
          // is within 2p
          const within = 0.02;
          if (!equalsPlusOrMinus(Math.abs(calculatedAmount), Math.abs(statedAmount) - Math.abs(fees), within)) {
            errors.push(`(${key} ${action}) Difference between calculated & stated amounts (with fees) of ${Math.abs(calculatedAmount - Math.abs(statedAmount)) - fees}`);
          }

          return { ...item, [T212_TOTAL]: calculatedAmount }
        });

        if (errors.length) {
          throw new Error(errors.join('\n'))
        }

        return result;
      },
    }],
    process: {
      [SOURCE_ID]: T212_EVENT_ID,
      [DATE]: T212_TIME, 
      [ACTION]: {
        from: T212_ACTION,
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
      [SYMBOL]: T212_TICKER,
      [QUANTITY]: T212_NO_OF_SHARES,
      [SHARE_PRICE]: {
        from: [
          T212_PRICE_SHARE, 
          T212_EXCHANGE_RATE, 
        ],
        fn: (price, exRate) => {
          
          assertIsNumberOrEmpty(price, "Price / Share");
          assertIsNumberOrEmpty(exRate, "Exchange Rate");
          
          if (isEmpty(price) && isEmpty(exRate)) {
            return EMPTY;
          }

          if (isEmpty(price) || isEmpty(exRate)) {
            throw new Error('Expected both "Price / Share" and "Exchange Rate" to be set, or not set. Encountered a mixed scenario')
          }
          
          return price / exRate
        }
      },
      [FEES]: {
        from: [
          T212_STAMP_DUTY,
          T212_STAMP_DUTY_RESERVE_TAX,
          T212_PTM_LEVY,
        ],
        fn: (stampDuty, stampDutyReserve, pmtLevy) => {
          assertIsNumberOrEmpty(stampDuty, "Stamp duty");
          assertIsNumberOrEmpty(stampDutyReserve, "Stamp duty reserve tax");
          assertIsNumberOrEmpty(pmtLevy, "Ptm levy");
          
          if (isEmpty(stampDuty) && isEmpty(stampDutyReserve) && isEmpty(pmtLevy)) {
            return EMPTY;
          }

          return (stampDuty || 0) + (stampDutyReserve || 0) + (pmtLevy || 0);
        }
      },
      [AMOUNT]: {
        from: T212_TOTAL,
        fn: (amount) => {
          if (isNaN(amount)) {
            return amount;
          }

          return Math.abs(amount);
        }
      },
      [CURRENCY]: T212_CURRENCY_TOTAL
    },
    postProcess: [],
  };
}


