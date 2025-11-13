// I had a total of 30 NVDA shares when the stock split. 
// I was awarded an additional 270 shares. 
// This gives a total of 300 shares against my original 30 shares, so 10:1 split. 
// I need to multiply my old shares by 10 and divide their respective purchase prices by 10. T
// hen I can remove the Stock Split line.
const csthConsolidateMarketSplits = (csthColumns, constants) => {
  
  const {
    DATE,
    ACTION,
    SYMBOL,
    QUANTITY,
    SHARE_PRICE,
  } = csthColumns;

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

      const splitDate = split[DATE];
      const splitSymbol = split[SYMBOL];
      const splitQuantity = split[QUANTITY];

      // Get all items for this symbol before the split date
      const inscope = data.filter(item => item[SYMBOL] === splitSymbol && item[DATE] < splitDate && splitableActions.includes(item[ACTION]));
      // add up the total number of shares
      const inscopeQuantity = inscope.reduce((sum, item) => sum + item[QUANTITY], 0);
      const totalQuantity = splitQuantity + inscopeQuantity;
      
      const multiplier = totalQuantity / inscopeQuantity;
      
      if (multiplier % 1 != 0) {
        throw new Error(`Calculated a stock split multiplier for ${splitSymbol} on ${splitDate} that NOT a whole number (${multiplier})`)
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

const csthConsolidateDistributedActions = (csthColumns, constants) => {
    
  const {
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

  const {
    BUY,
    SELL,
    AWARD,
    DIVIDEND,
  } = constants.actions;

  const dateFormattingOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const groupableActions = [BUY, SELL, AWARD, DIVIDEND];

  const sumProp = (arr, prop) => {
      return arr.reduce((s, item) => {
        if (typeof item[prop] === 'number') {
          return s + item[prop];
        }
        return s;
      }, 0)
    }

  const exec = (data) => {
        
    // groups transactions together
    const groupedRaw = Object.groupBy(data, (item) =>{
      return [
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
    
    const dataSum = sumProp(data, QUANTITY) + 
                    sumProp(data, FEES) + 
                    sumProp(data, AMOUNT);
    const resultSum = sumProp(resultantData, QUANTITY) + 
                    sumProp(resultantData, FEES) + 
                    sumProp(resultantData, AMOUNT);

    if (Math.round(dataSum * 100) !== Math.round(resultSum * 100)) {
      throw new Error('csthConsolidateDistributedActions: It looks like something has gone wrong here! Sums are different')
    }
    
    return resultantData;
  }

  return exec;
}



// Managing Transactions that have been broken apart into small pieces (e.g. buy 1000 shares, but there are 10x 100 share transactions)
      