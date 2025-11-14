const updateCombinedStockTransactionHistorySources = () => {

  const csthSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Combined Stock Transaction History');
  const csthColumns = initLabelledColumns(csthSheet, [
    'SOURCE_ID',
    'SOURCE_SHEET',
    'EVENT_ID',
    'DATE',
    'TAX_YEAR',
    'ACTION',
    'SYMBOL',
    'QUANTITY',
    'SHARE_PRICE',
    'FEES',
    'AMOUNT',
    'CURRENCY',
    'OFFSET_ID'
  ]);

  const actions = {
    BUY: 'BUY',
    SELL: 'SELL',
    AWARD: 'AWARD',
    DIVIDEND: 'DIVIDEND',
    TAX: 'TAX',
    SPLIT: 'SPLIT',
    WITHDRAW: 'WITHDRAW',
    DEPOSIT: 'DEPOSIT',
    NONE: 'NONE'
  };
  
  const firstDataRow = 3;

  const helper = makeHelper(csthSheet, csthColumns);

  let data = readCombinedStockTransactionHistorySources(csthColumns, {actions});
  
  const existingDataRange = (csthSheet.getLastRow() >= firstDataRow) 
    ? helper.getRange(csthColumns.first, firstDataRow, csthColumns.last, csthSheet.getLastRow()) 
    : makeMockRange();

  data.forEach(item => item['EVENT_ID'] = makeEventId())
  data = calculateTransactionSplits(csthColumns, {actions}, data);

  const values = data.map(item => {
    return csthColumns.keys.reduce((array, key) => {
      array[csthColumns.colLabelToNumMap[key] - csthColumns.first] = item[key];
      return array;
    }, [])
  })


  // clear existing data (if any exists)
  existingDataRange.clearContent();
  helper.getRange(csthColumns.first, firstDataRow, csthColumns.last, firstDataRow + values.length - 1).setValues(values)
}

// every SELL action must be backed by a corresponding BUY or AWARD transaction
const calculateTransactionSplits = (csthColumns, constants, _data) => {
  const {
    SOURCE_ID,
    SOURCE_SHEET,
    EVENT_ID,
    DATE,
    TAX_YEAR,
    ACTION,
    SYMBOL,
    QUANTITY,
    SHARE_PRICE,
    FEES,
    AMOUNT,
    CURRENCY,
    OFFSET_ID
  } = csthColumns;

  const {
    BUY,
    SELL,
    AWARD,
    SPLIT,
  } = constants.actions;

  const buyActions = [BUY, AWARD];
  const sellActions = [SELL];

  const execCalculation = (data) => {

    const available = [];

    // itterate from oldest to newest
    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i];
      if (buyActions.includes(item.self[ACTION])) {
        available.push(item);
      } else if (sellActions.includes(item.self[ACTION])) {
        processSellTransaction(item, available);
      }
    }

    return data;
  }

  const getUnusedQuantity = node => isEmpty(node[OFFSET_ID]) ? node[QUANTITY] : 0;
  const getUsedQuantity = node => isEmpty(node[OFFSET_ID]) ? 0 : node[QUANTITY];

  const sumQuantities = (...items) => {
    return items.reduce((sum, child) => {
      const value = getUsedQuantity(child);
      return sum + value;
    }, 0);
  }

  const quantityRemaining = (item) => {
    const selfValue = getUnusedQuantity(item.self);
    const childrenValue = sumQuantities(...item.children);
    const result = selfValue - childrenValue;
    
    if (result < 0) {
      throw new Error(`Negative value remaining for source id "${item.self[SOURCE_ID]}"`)
    }

    if (Math.round(result * 10000) === 0) {
      return 0;
    }
    
    return result;
  }

  const propsMatch = (item1, item2, props) => {
    for (var i = 0; i < props.length; i++) {
      if (item1.self[props[i]] !== item2.self[props[i]]) {
        return false;
      }
    }

    return true;
  }

  // available will be ordered by oldest first
  const processSellTransaction = (sellItem, availableBuys) => {
    let sellRemaining = quantityRemaining(sellItem);

    for (let i = 0; i < availableBuys.length && sellRemaining !== 0; i++) {
      const buyItem = availableBuys[i];
      
      if (!propsMatch(sellItem, buyItem, [SOURCE_SHEET, SYMBOL])) {
        continue;
      }
      
      const buyRemaining = quantityRemaining(buyItem);

      if (buyRemaining === 0) {
        continue;
      }

      recordOffset(sellItem, buyItem, Math.min(buyRemaining, sellRemaining));

      sellRemaining = quantityRemaining(sellItem);
      const y = 0;
    }

    if (sellRemaining > 0) {
      throw new Error(`A sell tranaction could not be satisfied from the available pool of buy transactions for source id "${sellItem.self[SOURCE_ID]}"`)
    }
  }

  const recordOffset = (sellItem, buyItem, quantity) => {
    sellNode = getNodeToOffset(sellItem, quantity);
    buyNode = getNodeToOffset(buyItem, quantity);

    sellNode[OFFSET_ID] = buyNode[EVENT_ID];
    buyNode[OFFSET_ID] = sellNode[EVENT_ID];
  }

  const getNodeToOffset = (item, quantity) => {
    const remaining = quantityRemaining(item);
    
    if (remaining < quantity) {
      throw new Error(`getNodeToOffset requires that there is available remaining quantity in the node being offset`);
    }
    
    if (remaining === quantity && item.children.length === 0) {
      return item.self;
    }

    return splitTransaction(item, quantity);
  }

  const splitTransaction = (item, quantity) => {
    const remaining = quantityRemaining(item);
    if (remaining < quantity) {
      throw new Error(`Split transaction by ${quantity} units but only ${remaining} units remain for source id ${item[SOURCE_ID]}`)
    }

    const split = { 
      ...item.self, 
      [SOURCE_ID]: '',
      [EVENT_ID]: makeEventId(),
      [QUANTITY]: quantity, 
      [AMOUNT]: item.self[SHARE_PRICE] * quantity, 
      [FEES]: '', 
    };

    item.children.splice(0, 0, split);
    
    return split;
  }

  const constructStackedData = (data) => {
    return [...data]
      // oldest last
      .sort((a, b) => b[DATE] - a[DATE])
      // debugging filter
      //.filter(a => a[SYMBOL] === 'BRBY')
      .map(item => ({ self: item, children: [] }));
  }

  const deconstructStackedData = (data) => {
    return resultantData = data.map(item => {
      if (item.children.length === 0) {
        return item.self;
      }

      const quantity = quantityRemaining(item);
      if (quantity > 0) {
        // fill any remaining portions
        splitTransaction(item, quantity);
      }

      return [
        { ...item.self, [ACTION]: SPLIT },
        ...item.children
      ]
      
    }).flat();
  }

  let stackedData = constructStackedData(_data);
  stackedData = execCalculation(stackedData);
  const data = deconstructStackedData(stackedData);

  throw new Error('LOOK AT TODO')
  // TODO:
  // 1. On Split rows, split fees into new line as well
  // 2. Verify that split rows sum up correctly (QUANTITY, FEES, AMOUNT) - there's something going on with amount

  // TODO: Validate that everything adds up like it should
  // This is pure error checking - we add up all of the values that we've combined 
  // across the original and new datasets and ensure that they match (within 2 decimal places, rounded)
  const initialSum = sumProps(_data, [QUANTITY, FEES, AMOUNT]);
  const splitsFilteredOut = resultantData.filter(item => item[ACTION] !== SPLIT);
  const resultantSum = sumProps(splitsFilteredOut, [QUANTITY, FEES, AMOUNT]);

  if (Math.round(initialSum * 100) !== Math.round(resultantSum * 100)) {
    throw new Error('calculateTransactionSplits: It looks like something has gone wrong here! Sums are different')
  }

  return data;
}



