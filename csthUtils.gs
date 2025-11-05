// I had a total of 30 NVDA shares when the stock split. 
// I was awarded an additional 270 shares. 
// This gives a total of 300 shares against my original 30 shares, so 10:1 split. 
// I need to multiply my old shares by 10 and divide their respective purchase prices by 10. T
// hen I can remove the Stock Split line.
const csthConsolidateStockSplits = (csthColumns, constants) => {
  
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
    NONE,
    UNKNOWN
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