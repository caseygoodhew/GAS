const csthConsolidateDistributedActionsDebug = () => {
  execCSTH();
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

    return resultantData;
  }

  return exec;
}