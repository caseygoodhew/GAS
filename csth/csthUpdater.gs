const updateCombinedStockTransactionHistorySources = () => {

  const csthSheet = getCombinedStockTransactionHistorySheet();
  const csthColumns = csthSheet.getColumns();
  const csthConstants = csthSheet.getConstants();

  const {
    EVENT_ID,
    DATE,
    TAX_YEAR,
    ACTION,
  } = csthColumns;

  const {
    MANUAL_SPLIT,
  } = csthConstants.actions;

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
      
      const result = fn(csthColumns, csthConstants)(
        // send a copy of the array so that fn is free to mutate values
        input.map(item => ({...item}))
      );

      csthValidateTotalsAreEquivalent(
        csthColumns, csthConstants
      )(fnName, input, result, config);
      return result;
    
    }, data);
  }

  /**************************************************
   * This is where the magic happens
   */
  const execUpdate = () => {

    let data = readCombinedStockTransactionHistorySources(csthColumns, csthConstants);
    
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

    csthSheet.setData(data);
  }

  execUpdate();
}





