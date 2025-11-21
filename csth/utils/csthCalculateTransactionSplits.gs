const csthCalculateTransactionSplitsDebug = () => {
  execCSTH();
}

// every SELL action must be backed by a corresponding BUY or AWARD transaction
const calculateTransactionSplits = (csthColumns, constants) => {
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

  if (!isString(QUANTITY)) {
    throw new Error(`Are you sure that you passed the correct parameters?`)
  }

  const {
    BUY,
    SELL,
    AWARD,
    MANUAL_SPLIT,
  } = constants.actions;

  const buyActions = [BUY, AWARD];
  const sellActions = [SELL];

  const execSplits = (data) => {

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

  const getUnusedByProp = (node, prop) => isEmpty(node[OFFSET_ID]) ? node[prop] : 0;
  const getUsedbyProp = (node, prop) => isEmpty(node[OFFSET_ID]) ? 0 : node[prop];

  const sumByProp = (items, prop) => {
    return items.reduce((sum, child) => {
      const value = getUsedbyProp(child, prop);
      return sum + value;
    }, 0);
  }

const remainingByProp = (item, prop) => {
    const selfValue = getUnusedByProp(item.self, prop);
    const childrenValue = sumByProp(item.children, prop);
    const result = selfValue - childrenValue;
    
    if (result < 0) {
      throw new Error(`Negative value of [${prop}] remaining for source id "${item.self[SOURCE_ID]}"`)
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
    let sellRemaining = remainingByProp(sellItem, QUANTITY);

    for (let i = 0; i < availableBuys.length && sellRemaining !== 0; i++) {
      const buyItem = availableBuys[i];
      
      if (!propsMatch(sellItem, buyItem, [SOURCE_SHEET, SYMBOL])) {
        continue;
      }
      
      const buyRemaining = remainingByProp(buyItem, QUANTITY);

      if (buyRemaining === 0) {
        continue;
      }

      recordOffsetByProp(sellItem, buyItem, QUANTITY, Math.min(buyRemaining, sellRemaining));

      sellRemaining = remainingByProp(sellItem, QUANTITY);
      const y = 0;
    }

    if (sellRemaining > 0) {
      throw new Error(`A sell tranaction could not be satisfied from the available pool of buy transactions for source id "${sellItem.self[SOURCE_ID]}"`)
    }
  }

  const recordOffsetByProp = (sellItem, buyItem, prop, value) => {
    sellNode = getNodeToOffsetByProp(sellItem, prop, value);
    buyNode = getNodeToOffsetByProp(buyItem, prop, value);

    sellNode[OFFSET_ID] = buyNode[EVENT_ID];
    buyNode[OFFSET_ID] = sellNode[EVENT_ID];
  }

  const getNodeToOffsetByProp = (item, prop, value) => {
    const remaining = remainingByProp(item, prop);
    
    if (remaining < value) {
      throw new Error(`getNodeToOffset requires that there is available remaining quantity in the node being offset`);
    }
    
    if (remaining === value && item.children.length === 0) {
      return item.self;
    }

    switch (prop) {
      case QUANTITY:
        return splitTransactionByQuantity(item, value);
      default:
        throw new Error(`Split function not registered for prop [${prop}]`)
    }
  }

  const splitTransactionByQuantity = (item, quantity) => {
    const remaining = remainingByProp(item, QUANTITY);
    if (remaining < quantity) {
      throw new Error(`Split transaction by ${quantity} units but only ${remaining} units remain for source id ${item[SOURCE_ID]}`)
    }

    return splitTransaction(
      item,
      {
        [QUANTITY]: quantity, 
        [AMOUNT]: item.self[SHARE_PRICE] * quantity, 
        [FEES]: '', 
      }
    )
  }

  const splitTransactionByFees = (item, fees) => {
    const remaining = remainingByProp(item, FEES);
    if (remaining < fees) {
      throw new Error(`Split transaction by ${fees} but only ${remaining} units remain for source id ${item[SOURCE_ID]}`)
    }

    return splitTransaction(
      item,
      {
        [QUANTITY]: '', 
        [SHARE_PRICE]: '', 
        [AMOUNT]: '', 
        [FEES]: fees, 
      }
    )
  } 

  const splitTransaction = (item, withProps) => {
    const split = { 
      ...item.self, 
      [SOURCE_ID]: '',
      [EVENT_ID]: makeEventId(),
      ...withProps
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

      const quantity = remainingByProp(item, QUANTITY);
      if (quantity > 0) {
        // fill any remaining portions
        splitTransactionByQuantity(item, quantity);
      }

      const fees = remainingByProp(item, FEES);
      if (fees > 0) {
        // fill any remaining portions
        splitTransactionByFees(item, fees)
      }

      return [
        { ...item.self, [ACTION]: MANUAL_SPLIT },
        ...item.children
      ]
      
    }).flat();
  }

  return (_data) => {
    let stackedData = constructStackedData(_data);
    stackedData = execSplits(stackedData);
    const data = deconstructStackedData(stackedData);

    //throw new Error('LOOK AT TODO')
    // TODO:
    // 1. On Split rows, split fees into new line as well

    return data;
  }
}