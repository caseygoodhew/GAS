const updateCombinedStockTransactionHistorySources = () => {

  const csthSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Combined Stock Transaction History');
  const csthColumns = initLabelledColumns(csthSheet, [
    'SOURCE_ID',
    'SOURCE_SHEET',
    'EVENT_ID',
    'DATE',
    'TAX_YEAR',
    'ACTION',
    'ACTION_PARAM',
    'SYMBOL',
    'QUANTITY',
    'SHARE_PRICE',
    'FEES',
    'AMOUNT',
    'CURRENCY',
  ]);

  const {
    SOURCE_ID,
    SOURCE_SHEET,
    EVENT_ID,
    DATE,
    TAX_YEAR,
    ACTION,
    ACTION_PARAM,
    SYMBOL,
    QUANTITY,
    SHARE_PRICE,
    FEES,
    AMOUNT,
    CURRENCY,
    OFFSET_ID
  } = csthColumns;

  const actions = {
    BUY: 'BUY',
    SELL: 'SELL',
    AWARD: 'AWARD',
    DIVIDEND: 'DIVIDEND',
    TAX: 'TAX',
    SPLIT: 'SPLIT',
    WITHDRAW: 'WITHDRAW',
    DEPOSIT: 'DEPOSIT',
    MANUAL_SPLIT: 'MANUAL SPLIT',
    NONE: 'NONE'
  };

  const {
    BUY,
    SELL,
    AWARD,
    DIVIDEND,
    TAX,
    SPLIT,
    WITHDRAW,
    DEPOSIT,
    MANUAL_SPLIT,
    NONE
  } = actions;

  const getFnNameAndConfig = (funcNameAndMaybeConfig) => {
    if (isArray(funcNameAndMaybeConfig)) {
      return {
        fnName: funcNameAndMaybeConfig[0], 
        config: funcNameAndMaybeConfig[1]
      }
    } else {
      return {
        fnName: funcNameAndMaybeConfig
      }
    }
  }

  const execAndValidate = (data, ...functions) => {
    return functions.reduce((input, funcNameAndMaybeConfig) => {
      
      const { fnName, config } = getFnNameAndConfig(funcNameAndMaybeConfig);
      
      if (!/^[a-z0-9_]+$/i.test(fnName)) {
        throw new Error(`The named function can only include alpha-numeric characters, as well as underscore _`);
      }

      const fn = eval(fnName);
      
      const result = fn(csthColumns, {actions})(
        // send a copy of the array so that fn is free to mutate values
        input.map(item => ({...item}))
      );

      csthValidateTotalsAreEquivalent(
        csthColumns, {actions}
      )(fnName, input, result, config);
      return result;
    
    }, data);
  }
  


  /**************************************************
   * This is where the magic happens
   */
  const execUpdate = () => {

    let data = readCombinedStockTransactionHistorySources(csthColumns, {actions});
    
    // manual updates common to all data sets
    data.forEach(item => {
      item[EVENT_ID] = makeEventId();
      item[TAX_YEAR] = toTaxYear(item[DATE]);
    });

    data = execAndValidate(data,
      'csthConsolidateMarketSplits',
      'csthConsolidateDistributedActions',
      'csthApplySensibleRounding',
      ['calculateTransactionSplits', { filter: item => item[ACTION] !== MANUAL_SPLIT }]
    );

    /************************************************
     * Adjust the data
     */
    
    // converts the data set into a correctly shaped array
    const values = data.map(item => {
      return csthColumns.keys.reduce((array, key) => {
        array[csthColumns.colLabelToNumMap[key] - csthColumns.first] = item[key];
        return array;
      }, [])
    })

    /************************************************
     * Prep and update the destination sheet
     */
    const helper = makeHelper(csthSheet, csthColumns);
    // TODO: this should come from a magic coordinate
    const firstDataRow = 3;

    const existingDataRange = (csthSheet.getLastRow() >= firstDataRow) 
      ? helper.getRange(csthColumns.first, firstDataRow, csthColumns.last, csthSheet.getLastRow()) 
      : makeMockRange();

    // clear existing data (if any exists)
    existingDataRange.clearContent();
    
    // set the values
    helper.getRange(csthColumns.first, firstDataRow, csthColumns.last, firstDataRow + values.length - 1).setValues(values);
  }

  execUpdate();
}





