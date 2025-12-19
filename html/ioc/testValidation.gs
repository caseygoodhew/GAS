function testIOCConfigurationValidation() {

  const runTest = (description, data, expected, expectedCount = 0) => {
    const validator = iocConfigurationValidator();
    const {status, results} = validator.validate(data);
    
    if (status !== expected) {
      throw new Error(`${description}: expected ${expected}, actual ${status} \n ${JSON.stringify(results, undefined, 2)}`);
    } else if (expectedCount !== results.length) {
      throw new Error(`${description}: expected ${expectedCount} issues, actual ${results.length} issues \n ${JSON.stringify(results, undefined, 2)}`);
    }
  }

  const { ERROR, WARN, OK } = iocConfigurationValidator().getConstants();

  const sample = getSampleIOCConfiguration();

  runTest('Sample data', sample, OK);
  
  // current
  runTest('[current] OK', [{ dateRangeMode: 'current', offsetPeriod: '1-day' }], OK);
  runTest('[current] Empty offset period', [{ dateRangeMode: 'current' }], ERROR, 1);
  runTest('[current] Invalid offset period', [{ dateRangeMode: 'current', offsetPeriod: '1-dayz' }], ERROR, 1);

  // fixed-start
  runTest('[fixed-start] OK', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-day', startDate: '2025-01-01' }], OK);
  runTest('[fixed-start] Empty start date', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-day' }], ERROR, 1);
  runTest('[fixed-start] Invalid start date', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-day', startDate: '1999-01-01' }], ERROR, 1);

  runTest('[fixed-start] Empty offset period', [{ dateRangeMode: 'fixed-start', startDate: '2025-01-01' }], ERROR, 1);
  runTest('[fixed-start] Invalid offset period', [{ dateRangeMode: 'fixed-start', offsetPeriod: '1-dayz', startDate: '2025-01-01' }], ERROR, 1);
  
  // fixed-end
  runTest('[fixed-end] OK', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-day', endDate: '2025-01-01' }], OK);
  runTest('[fixed-end] Empty end date', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-day' }], ERROR, 1);
  runTest('[fixed-end] Invalid end date', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-day', endDate: '1999-01-01' }], ERROR, 1);

  runTest('[fixed-end] Empty offset period', [{ dateRangeMode: 'fixed-end', endDate: '2025-01-01' }], ERROR, 1);
  runTest('[fixed-end] Invalid offset period', [{ dateRangeMode: 'fixed-end', offsetPeriod: '1-dayz', endDate: '2025-01-01' }], ERROR, 1);
  
  // tax-year
  runTest('[tax-year] OK', [{ dateRangeMode: 'tax-year', taxYear: '24/25' }], OK);
  runTest('[tax-year] Empty tax year', [{ dateRangeMode: 'tax-year' }], ERROR, 1);
  runTest('[tax-year] Invalid tax year', [{ dateRangeMode: 'tax-year', taxYear: '24--25' }], ERROR, 1);
  runTest('[tax-year] Out of range tax year', [{ dateRangeMode: 'tax-year', taxYear: '21/22' }], ERROR, 1);
  runTest('[tax-year] Malformed tax year', [{ dateRangeMode: 'tax-year', taxYear: '23/25' }], ERROR, 1);

  // same-as
  runTest('[same-as] OK', [{ dateRangeMode: 'same-as', dateSameAs: '2' }], OK);
  runTest('[same-as] Empty date same as', [{ dateRangeMode: 'same-as' }], ERROR, 1);
  runTest('[same-as] Empty date same as', [{ dateRangeMode: 'same-as', dateSameAs: 'A' }], ERROR, 1);
  runTest('[same-as] Circular reference', [{ dateRangeMode: 'same-as', dateSameAs: '2' }, { dateRangeMode: 'same-as', dateSameAs: '1' }], ERROR, 2);

  // custom
  runTest('[custom] OK', [{ dateRangeMode: 'custom', startDate: '2024-01-01', endDate: '2025-01-01' }], OK);
  runTest('[custom] Invalid start date', [{ dateRangeMode: 'custom', startDate: 'startDate', endDate: '2025-01-01' }], ERROR, 1);
  runTest('[custom] Invalid end date', [{ dateRangeMode: 'custom', startDate: '2024-01-01', endDate: 'endDate' }], ERROR, 1);
  runTest('[custom] Invalid start and end dates', [{ dateRangeMode: 'custom', startDate: '2004-01-01', endDate: '2020-01-01' }], ERROR, 2);
  runTest('[custom] Start date is after end date', [{ dateRangeMode: 'custom', startDate: '2025-01-01', endDate: '2024-01-01' }], WARN, 1);
  
}
