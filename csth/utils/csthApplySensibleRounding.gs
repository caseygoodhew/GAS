const csthApplySensibleRoundingDebug = () => {
  execCSTH();
}

// Some transactions have many decimal places (e.g. 1.040328374636 units)
// that cause very small discrepencies between in js math (e.g. 5.0456e-14)
// We really don't require fine grained fidelity in our numbers, so we're going to round
// them out. As long as numbers work out to the nearest dollar/pound, we're happy
const csthApplySensibleRounding = (csthColumns, constants) => {
    
  const {
    SOURCE_SHEET,
    ACTION,
    SYMBOL,
    SHARE_PRICE,
    QUANTITY,
    FEES,
    AMOUNT
  } = csthColumns;

  if (!isString(ACTION)) {
    throw new Error(`Are you sure that you passed the correct parameters?`)
  }

  const {
    BUY,
    SELL,
    AWARD,
  } = constants.actions;

  const roundToDecimalPlaces = {
    [QUANTITY]: 4,
    [SHARE_PRICE]: [4],
    [FEES]: 2,
    [AMOUNT]: 2
  }

  const roundProp = (itemOrValue, prop) => {
    const value = typeof itemOrValue === 'object' && itemOrValue !== null ? itemOrValue[prop] : itemOrValue;
    
    if (isEmpty(value)) {
      return value;
    }

    if (!isNumber(value)) {
      throw new Error(`Expected [${prop}] to be empty or a number. Got ${value}`);
    }

    if (!roundToDecimalPlaces[prop]) {
      throw new Error(`Could not determine number of decimal places for [${prop}]`);
    }
    
    const mult = Math.pow(10, roundToDecimalPlaces[prop]);
    return Math.round(value * mult) / mult;
  }

  const countDecimals = (value) => {
    
    if (isEmpty(value) || !isNumber(value)) {
      return -1;
    }

    if (Math.floor(value) === value) {
      return 0;
    }
    
    return value.toString().split(".")[1].length || 0;
  }

  const exec = (data) => {
        
    const transactionMap = {};
    
    const result = data.map(item => {

      const quantity = roundProp(item, QUANTITY);
      const sharePrice = roundProp(item, SHARE_PRICE);
      const calculatedAmount = (isEmpty(quantity) || isEmpty(sharePrice))
                              ? item[AMOUNT]
                              : quantity * sharePrice;

      if (!equalsPlusOrMinus(calculatedAmount, item[AMOUNT], 0.1)) {
        const aaa = 5;
      }

      const newItem = {
        ...item,
        [QUANTITY]: quantity,
        [SHARE_PRICE]: sharePrice,
        [AMOUNT]: roundProp(calculatedAmount, AMOUNT),
        [FEES]: roundProp(item, FEES)
      }

      if ([BUY, SELL, AWARD].includes(item[ACTION])) {
        const decimalCount = countDecimals(item[QUANTITY]);
        const key = [item[SOURCE_SHEET], item[SYMBOL]].join('|')
        transactionMap[key] = transactionMap[key] || [];
        transactionMap[key].push({
          item: newItem, 
          decimals: decimalCount
        })
      }

      return newItem;
    })
  
    Object.values(transactionMap).forEach((transactions) => {
      const sellTransactions = transactions.filter(({ item }) => item[ACTION] === SELL);

      const sellSum = sumProp(
        sellTransactions
          .map(({ item }) => item)
      , QUANTITY);

      const buySum = sumProp(
        transactions
          .filter(({ item }) => item[ACTION] !== SELL)
          .map(({ item }) => item)
      , QUANTITY);

      if (sellSum <= buySum) {
        // all ok
        return;
      }

      const delta = sellSum - buySum;

      // this means we've sold more than we've bought, so we would expect this to be very very close
      if (delta > 0.1) {
        throw new Error(`After rounding, it seems that we've sold more ${transactions[0].item[SYMBOL]} stock than we've purchased (${sellSum} vs ${buySum})`)
      }

      // so now we know that it's a small descrepency - let's adjust it against the SELL order with the most decimal places in the QUANTITY
      const {item: useTransaction} = sellTransactions.reduce((target, item) => {
        return item.decimals > target.decimals && item.item[QUANTITY] > delta ? item : target;
      }, {decimals: -2});

      if (!useTransaction.decimals < 0) {
        throw new Error(`Could not find a suitable transaction to adjust QUANTITY rounding for ${transactions[0][SYMBOL]}`)
      }

      useTransaction[QUANTITY] -= delta;
      useTransaction[AMOUNT] = roundProp(useTransaction[QUANTITY] * useTransaction[SHARE_PRICE], AMOUNT);
    });
  
    return result;
  }

  return exec;
}