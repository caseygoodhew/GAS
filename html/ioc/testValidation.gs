function testIOCConfigurationValidation() {

  const sample = getSampleIOCConfiguration();
  const dateFrag = { dateRangeMode: 'current', offsetPeriod: '1-day' };
  const dataFrag = { dataSetMode: 'defined', lines: [] };
  const { ERROR, WARN, OK } = iocConfigurationValidator().getConstants();

  
  const execWithErrorsHandled = (description, data) => {
    try {
      const validator = iocConfigurationValidator();
      return validator.validate(data);
    } catch (e) {
      throw new Error(`${description} threw:\n. ${e.message}`)
    }
  }
  
  const runTest = (description, data, expected, expectedCount = 0) => {
    
    const {status, results} = execWithErrorsHandled(description, data);
    
    if (status !== expected) {
      throw new Error(`${description}: expected ${expected}, actual ${status} \n ${JSON.stringify(results, undefined, 2)}`);
    } else if (expectedCount !== results.length) {
      throw new Error(`${description}: expected ${expectedCount} issues, actual ${results.length} issues \n ${JSON.stringify(results, undefined, 2)}`);
    }
  }

  const runDateTest = (description, data, expected, expectedCount = 0) => {
    runTest('[date-test]'+description, data.map(item => ({ ...dataFrag, ...item })), expected, expectedCount);
  };

  const runDataTest = (description, data, expected, expectedCount = 0) => {
    runTest('[data-test]'+description, data.map(item => ({ ...dateFrag, ...item })), expected, expectedCount);
  };
  

  // The sample is data is an actual block generated from the UI. 
  // We want to be sure that it passes with "OK" as a generalized test
  runTest('Sample data', sample, OK);
  runTest('Frags should pass', [{ ...dateFrag, ...dataFrag }], OK);

  /**
   * Dat*E* Range
   */
  // current
  runDateTest('[current] OK', [{ dateRangeMode: 'current', offsetPeriod: '1-day' }], OK);
  runDateTest('[current] Empty offset period', [{ dateRangeMode: 'current' }], ERROR, 1);
  runDateTest('[current] Invalid offset period', [{ dateRangeMode: 'current', offsetPeriod: '1-dayz' }], ERROR, 1);

  // fixed-start
  runDateTest('[fixed-start] OK', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-day', startDate: '2025-01-01' }], OK);
  runDateTest('[fixed-start] Empty start date', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-day' }], ERROR, 1);
  runDateTest('[fixed-start] Invalid start date', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-day', startDate: '1999-01-01' }], ERROR, 1);

  runDateTest('[fixed-start] Empty offset period', [{ dateRangeMode: 'fixed-start', startDate: '2025-01-01' }], ERROR, 1);
  runDateTest('[fixed-start] Invalid offset period', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-dayz', startDate: '2025-01-01' }], ERROR, 1);
  
  // fixed-end
  runDateTest('[fixed-end] OK', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-day', endDate: '2025-01-01' }], OK);
  runDateTest('[fixed-end] Empty end date', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-day' }], ERROR, 1);
  runDateTest('[fixed-end] Invalid end date', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-day', endDate: '1999-01-01' }], ERROR, 1);

  runDateTest('[fixed-end] Empty offset period', [{ dateRangeMode: 'fixed-end', endDate: '2025-01-01' }], ERROR, 1);
  runDateTest('[fixed-end] Invalid offset period', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-dayz', endDate: '2025-01-01' }], ERROR, 1);
  
  // tax-year
  runDateTest('[tax-year] OK', [{ dateRangeMode: 'tax-year', taxYear: '24/25' }], OK);
  runDateTest('[tax-year] Empty tax year', [{ dateRangeMode: 'tax-year' }], ERROR, 1);
  runDateTest('[tax-year] Invalid tax year', [{ dateRangeMode: 'tax-year', taxYear: '24--25' }], ERROR, 1);
  runDateTest('[tax-year] Out of range tax year', [{ dateRangeMode: 'tax-year', taxYear: '21/22' }], ERROR, 1);
  runDateTest('[tax-year] Malformed tax year', [{ dateRangeMode: 'tax-year', taxYear: '23/25' }], ERROR, 1);

  // same-as
  runDateTest('[same-as] OK', [{ dateRangeMode: 'same-as', dateSameAs: '2' }], OK);
  runDateTest('[same-as] Empty date same as', [{ dateRangeMode: 'same-as' }], ERROR, 1);
  runDateTest('[same-as] Empty date same as', [{ dateRangeMode: 'same-as', dateSameAs: 'A' }], ERROR, 1);
  runDateTest('[same-as] Circular reference', [{ dateRangeMode: 'same-as', dateSameAs: '2' }, { dateRangeMode: 'same-as', dateSameAs: '1' }], ERROR, 2);

  // custom
  runDateTest('[custom] OK', [{ dateRangeMode: 'custom', startDate: '2024-01-01', endDate: '2025-01-01' }], OK);
  runDateTest('[custom] Invalid start date', [{ dateRangeMode: 'custom', startDate: 'startDate', endDate: '2025-01-01' }], ERROR, 1);
  runDateTest('[custom] Invalid end date', [{ dateRangeMode: 'custom', startDate: '2024-01-01', endDate: 'endDate' }], ERROR, 1);
  runDateTest('[custom] Invalid start and end dates', [{ dateRangeMode: 'custom', startDate: '2004-01-01', endDate: '2020-01-01' }], ERROR, 2);
  runDateTest('[custom] Start date is after end date', [{ dateRangeMode: 'custom', startDate: '2025-01-01', endDate: '2024-01-01' }], WARN, 1);
  
  /**
   * Dat*A* Range
   */
  runDataTest('[defined][all] OK', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'all' }] }], OK);
  
  runDataTest('[defined][account] OK', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'account', account: 'CHARLES_SCHWAB' }] }], OK);
  runDataTest('[defined][account] Empty account', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'account', account: '' }] }], ERROR, 1);
  runDataTest('[defined][account] Missing account', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'account' }] }], ERROR, 1);
  runDataTest('[defined][account] Unknonw account', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'account', account: 'NOPE' }] }], ERROR, 1);

  runDataTest('[defined][symbol] OK with 1', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'holding', symbols: ['META'] }] }], OK);
  runDataTest('[defined][symbol] OK with many', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'holding', symbols: ['META', 'GOOG', 'AAPL'] }] }], OK);
  runDataTest('[defined][symbol] Empty symbols', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'holding', symbols: [] }] }], ERROR, 1);
  runDataTest('[defined][symbol] Missing symbols', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'holding' }] }], ERROR, 1);
  runDataTest('[defined][symbol] Unknown symbol', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'holding', symbols: ['FOO'] }] }], ERROR, 1);
  runDataTest('[defined][symbol] Unknown symbols', [{ dataSetMode: 'defined', lines: [{ dataSetLineMode: 'holding', symbols: ['FOO', 'BAR'] }] }], ERROR, 2);

  runDataTest('[performance] OK by top, none', [{ dataSetMode: 'performance', byPerformance: 'top', performanceFilter: 'none' }], OK);
  runDataTest('[performance] OK by bottom, none', [{ dataSetMode: 'performance', byPerformance: 'bottom', performanceFilter: 'none' }], OK);
  runDataTest('[performance] OK by top, CHARLES_SCHWAB', [{ dataSetMode: 'performance', byPerformance: 'top', performanceFilter: 'CHARLES_SCHWAB' }], OK);
  runDataTest('[performance] Missing byPerformance', [{ dataSetMode: 'performance', performanceFilter: 'none' }], ERROR, 1);
  runDataTest('[performance] Missing performanceFilter', [{ dataSetMode: 'performance', byPerformance: 'top' }], ERROR, 1);
  runDataTest('[performance] Invalid byPerformance', [{ dataSetMode: 'performance', byPerformance: 'INVALID', performanceFilter: 'none' }], ERROR, 1);
  runDataTest('[performance] Invalid performanceFilter', [{ dataSetMode: 'performance', byPerformance: 'top', performanceFilter: 'INVALID' }], ERROR, 1);
  
  runDataTest('[same-as] OK', [{ dataSetMode: 'same-as', dataSetSameAs: '2' }], OK);
  runDataTest('[same-as] Empty date same as', [{ dataSetMode: 'same-as' }], ERROR, 1);
  runDataTest('[same-as] Empty date same as', [{ dataSetMode: 'same-as', dataSetSameAs: 'A' }], ERROR, 1);
  runDataTest('[same-as] Circular reference', [{ dataSetMode: 'same-as', dataSetSameAs: '2' }, { dataSetMode: 'same-as', dataSetSameAs: '1' }], ERROR, 2);
}








