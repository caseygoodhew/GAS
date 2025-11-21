const csthUtilsDebug = () => {
  execCSTH();
}

const sumProp = (arr, prop) => {
  return arr.reduce((s, item) => {
    const value = item[prop];
    if (typeof value === 'number') {
      return s + value;
    }
    return s;
  }, 0)
}

const sumProps = (arr, props) => {
  return props.reduce((sum, prop) => {
    return sum + sumProp(arr, prop);
  }, 0);
}

// I had a total of 30 NVDA shares when the stock split. 
// I was awarded an additional 270 shares. 
// This gives a total of 300 shares against my original 30 shares, so 10:1 split. 
// I need to multiply my old shares by 10 and divide their respective purchase prices by 10. T
// hen I can remove the Stock Split line.
const csthConsolidateMarketSplits = (csthColumns, constants) => {
  
  const {
    SOURCE_SHEET,
    DATE,
    ACTION,
    SYMBOL,
    QUANTITY,
    SHARE_PRICE,
  } = csthColumns;

  if (!isString(QUANTITY)) {
    throw new Error(`Are you sure that you passed the correct parameters?`)
  }

  const {
    BUY,
    SELL,
    AWARD,
    SPLIT,
  } = constants.actions;

  const splitableActions = [BUY, SELL, AWARD];

  const exec = (data) => {
    // all stock splits, oldest first
    const stockSplits = data.filter(item => item[ACTION] === SPLIT).sort((a, b) => a - b);
    data = data.filter(item => item[ACTION] !== SPLIT);
    
    stockSplits.forEach(split => { 

      const splitSheet = split[SOURCE_SHEET];
      const splitDate = split[DATE];
      const splitSymbol = split[SYMBOL];
      const splitQuantity = split[QUANTITY];

      // Get all items for this symbol before the split date
      const inscope = data.filter(item => 
        item[SOURCE_SHEET] === splitSheet &&
        item[SYMBOL] === splitSymbol && 
        item[DATE] < splitDate && 
        splitableActions.includes(item[ACTION])
      );
      
      // add up the total number of shares
      const inscopeQuantity = inscope.reduce((sum, item) => sum + item[QUANTITY], 0);
      const totalQuantity = splitQuantity + inscopeQuantity;
      
      const multiplier = totalQuantity / inscopeQuantity;
      
      if (multiplier % 1 != 0) {
        throw new Error(`Calculated a stock split multiplier for ${splitSymbol} on ${splitDate} that NOT a whole number (${multiplier})`);
      }

      inscope.forEach(item => {
        item[QUANTITY] = item[QUANTITY] * multiplier;
        item[SHARE_PRICE] = Math.round(1000 * item[SHARE_PRICE] / multiplier) / 1000;
      });
    });

    return data;
  }

  return exec;
}

// Managing Transactions that have been broken apart into small pieces 
// (e.g. buy 1000 shares, but there are 10x 100 share transactions)
const csthConsolidateDistributedActions = (csthColumns, constants) => {
    
  const {
    SOURCE_SHEET,
    ACTION,
    SYMBOL,
    SHARE_PRICE,
    CURRENCY,
    DATE,
    SOURCE_ID,
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
    DIVIDEND,
  } = constants.actions;

  const dateFormattingOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const groupableActions = [BUY, SELL, AWARD, DIVIDEND];

  const exec = (data) => {
        
    // groups transactions together
    const groupedRaw = Object.groupBy(data, (item) =>{
      return [
        item[SOURCE_SHEET],
        item[ACTION],
        item[SYMBOL],
        item[SHARE_PRICE],
        item[CURRENCY],
        item[DATE].toLocaleDateString("en-UK", dateFormattingOptions)
      ].join('|');
    });
  
    // filters out any transactions that are not of a specific action type, or that are single transactions
    const toCombine = Object.values(groupedRaw).filter(group => group.length > 1 && groupableActions.includes(group[0][ACTION]));

    // 1. combines the transactions (i.e. adds correct values together)
    // 2. stores the SOURCE_IDs that make up the transaction
    const reducedGroups = toCombine.map(grouped => grouped.reduce((acc, item) => {

      // initialize the new record on the first itteration
      if (!acc.item) {
        acc.item = { ...item };
        acc.item[SOURCE_ID] = '';
        acc.item[QUANTITY] = 0;
        acc.item[FEES] = 0;
        acc.item[AMOUNT] = 0;
      }
        
      // takes the earlier date from the same day
      if (acc.item[DATE] > item[DATE]) {
        acc.item[DATE] = item[DATE];
      }
      
      if (isNumber(item[QUANTITY])) {
        acc.item[QUANTITY] += item[QUANTITY];
      }

      if (isNumber(item[FEES])) {
        acc.item[FEES] += item[FEES];
      }

      if (isNumber(item[AMOUNT])) {
        acc.item[AMOUNT] += item[AMOUNT]
      }
      
      // store the source ID
      acc.sourceIds.push(item[SOURCE_ID]);
      return acc;

    }, { item: undefined, sourceIds: [] }));

    // 1. calculates a new SOURCE_ID key based on all SOURCE_IDs for each new record
    // 2. sets the key against the item
    // 3. creates a map of the original SOURCE_ID to the (new) calculated SOURCE_ID
    // 4. creates a map of the (new) calculated SOURCE_ID to the new record
    const { sourceIdMap, itemMap } = reducedGroups.reduce((acc, { item, sourceIds }) => {
      const key = sourceIds.join('|');
      
      for (let i = 0; i < sourceIds.length; i++) {
        acc.sourceIdMap[sourceIds[i]] = key;
      }

      item[SOURCE_ID] = key;
      acc.itemMap[key] = item;

      return acc;
    }, { sourceIdMap: {}, itemMap: {} })
    
    // holds the new dataset that we'll return
    const resultantData = [];

    // rebuilds the dataset so that combined transactions are squished together in an
    // approximately correct position within the dataset
    for (let i = 0; i < data.length; i++) {
      const key = sourceIdMap[data[i][SOURCE_ID]];
      if (!key) {
        resultantData.push(data[i]);
      }

      if (itemMap[key]) {
        resultantData.push(itemMap[key]);
        delete itemMap[key]; 
      }
    }

    // This is pure error checking - we add up all of the values that we've combined 
    // across the original and new datasets and ensure that they match (within 2 decimal places, rounded)
    const dataSum = sumProps(data, [QUANTITY, FEES, AMOUNT]);
    const resultSum = sumProps(resultantData, [QUANTITY, FEES, AMOUNT]);

    if (Math.round(dataSum * 100) !== Math.round(resultSum * 100)) {
      throw new Error('csthConsolidateDistributedActions: It looks like something has gone wrong here! Sums are different')
    }
    
    return resultantData;
  }

  return exec;
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

const validateTotalsAreEquivalent = (csthColumns, constants) => {
    
  const {
    QUANTITY,
    FEES,
    AMOUNT
  } = csthColumns;

  if (!isString(QUANTITY)) {
    throw new Error(`Are you sure that you passed the correct parameters?`)
  }

  const getDefaultConfig = () => {
    return {
      props: [QUANTITY, FEES, AMOUNT],
      filter: () => true,
      marginOfError: 1
    };
  }

  const applyDefaults = config => {
    const defaultConfig = getDefaultConfig();
    
    if (config == null) {
      return defaultConfig;
    }

    if (!isObject(config)) {
      throw new Error(`Expected config to be a pure object, got ${typeof config} (${config})`);
    }

    return Object.keys(config).reduce((conf, key) => {
      conf[key] = config[key];
      return conf;
    }, defaultConfig);
  }

  const exec = (context, dataSet1, dataSet2, config) => {
    if (!isArray(dataSet1)) {
      throw new Error(`Expected dataSet1 to be an array, got ${typeof dataSet1}`);
    }

    if (!isArray(dataSet2)) {
      throw new Error(`Expected dataSet1 to be an array, got ${typeof dataSet2}`);
    }
    
    const { props, filter, marginOfError } = applyDefaults(config);

    const ds1 = dataSet1.filter(filter);
    const ds2 = dataSet2.filter(filter);

    props.forEach(prop => {
      const ds1Sum = sumProp(ds1, prop);
      const ds2Sum = sumProp(ds2, prop);

      if (!equalsPlusOrMinus(ds1Sum, ds2Sum, marginOfError)) {
        throw new Error(`[${context}] Sum of [${prop}]s are not equal. ${numberWithCommas(ds1Sum)} vs ${numberWithCommas(ds2Sum)} (diff of ${numberWithCommas(Math.abs(ds1Sum - ds2Sum))})`);
      }
    }); 
  }

  return exec;
}
