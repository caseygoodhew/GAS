const iocConfigurationValidator = () => {

  const ERROR = 'ERROR';
  const WARN = 'WARN';
  const OK = 'OK';

  const offsetPeriodRe = transformIOCConfiguration().getOffsetPeriodRe();
  const taxYearRe = transformIOCConfiguration().getTaxYearRe();

  const validationResult = (() => {
    const results = [];

    const funcs = {
      record: (passed, context) => {
        if (!passed) {
          results.push(context);
        }
      },

      getResult: () => {
        
        const status = results.reduce((acc, item) => {
          //         ||  ERROR  |  WARN   |   OK    | 
          //  ======================================
          //   ERROR ||  ERROR  |  ERROR  |  ERROR  |
          //  --------------------------------------
          //   WARN  ||  ERROR  |  WARN   |  WARN   |
          //  --------------------------------------
          //   OK    ||  ERROR  |  WARN   |   OK    |
          //
          
          
          if (acc === ERROR || item.level === ERROR) {
            return ERROR;
          }

          if (acc === WARN || item.level === WARN) {
            return WARN;
          }

          return OK;
        }, OK);
        
        
        return {
          status,
          results
        }
      }
    }

    return funcs;
  })();

  const funcs = {
    validateAll: data => {
      data.forEach((item, index) => funcs.validateOne(item, { secNum: index + 1 }))
      
      funcs.validateSameAsLoops(
        data.map(item => ({ mode: item.dateRangeMode, sameAs: parseInt(item.dateSameAs) })),
        { prop: 'dateSameAs' }
      );

      funcs.validateSameAsLoops(
        data.map(item => ({ mode: item.dataSetMode, sameAs: parseInt(item.dataSetSameAs) })),
        { prop: 'dataSetSameAs' }
      );
    },

    validateOne: (item, context) => {
      switch (item.dateRangeMode) {
        case 'current':
          funcs.validateOffsetPeriod(item, context);
          break;
        case 'fixed-start':
          funcs.validateStartDate(item, context);
          funcs.validateOffsetPeriod(item, context);
          break;
        case 'fixed-end':
          funcs.validateEndDate(item, context);
          funcs.validateOffsetPeriod(item, context);
          break;
        case 'tax-year':
          funcs.validateTaxYear(item, context);
          break;
        case 'same-as':
          funcs.validateDateSameAs(item, context)
          break;
        case 'custom':
          funcs.validateStartDate(item, context);
          funcs.validateEndDate(item, context);
          funcs.validateStartDateIsLessThanEndDate(item, context);
          break;
        default:
          throw new Error(`Unknown dateRangeMode "${item.dateRangeMode}"`);
      }

      switch (item.dataSetMode) {
        case 'defined':
          item.lines.forEach((line, index) => funcs.validateOneLineData(line, { ...context, lineNum: index + 1 }));
          break;
        
        case 'performance':
          funcs.validateByPerformance(item, context);
          funcs.validatePerformanceFilter(item, context);
          break;
        
        case 'same-as':
          funcs.validateDataSetSameAs(item, context);
          break;
        
        default:
          debugger;
          throw new Error(`Unknown dataSetMode "${item.dataSetMode}"`);
      }
    },

    validateSameAsLoops: (data, context) => {
      const looksBad = data.reduce((looksBad, {mode, sameAs}, index) => {
        if (mode !== 'same-as') { return looksBad; }
        return looksBad || isNaN(sameAs) || sameAs === (index + 1);
      }, false);

      if (looksBad) {
        // this should be picked up by another validator
        return;
      }
      
      const map = data.reduce((acc, item, index) => {
        acc[index + 1] = item.mode === 'same-as' ? item.sameAs : null;
        return acc;
      }, {});
      
      const results = Object.keys(map).map(key => {
        let secNum = key;
        const visited = [];
        let circular = false;
        while (!circular && map[secNum]) {
          circular = visited.includes(secNum) ? secNum : false;
          visited.push(secNum);
          secNum = map[secNum];
        }
        return circular;
      });

      results.forEach(secNum => {
        if (!secNum) {
          return;
        }

        validationResult.record(false, {
          ...context,
          level: ERROR,
          secNum,
          message: `Same as (${context.prop}) has a circular same-as reference`
        });
      });

    },

    validateStartDateIsLessThanEndDate: (item, context) => {
      const start = funcs.getDateParts(item.startDate);
      const end = funcs.getDateParts(item.endDate);

      if (!start || !end) {
        return;
      }

      let result = false;

      if (start.year < end.year) {
        result = true;
      } else if (start.year > end.year) {
        result = false;
      } else if (start.month < end.month) {
        result = true;
      } else if (start.month > end.month) {
        result = false;
      } else if (start.day <= end.day) {
        result = true;
      }

      validationResult.record(result, {
        ...context,
        level: WARN,
        message: `Start date (${item.startDate}) is later than end date (${item.endDate}) - this has been corrected in the chart`
      });
    },

    validateByPerformance: (item, context) => {
      const value = item.byPerformance;
      const expectedPerformances = ['top', 'bottom'];

      validationResult.record(
        expectedPerformances.includes(value), {
        ...context,
        prop: 'byPerformance',
        level: ERROR,
        message: `Unexpected value for byPerformance (${value}) - expected one of ['${expectedPerformances.join("', '")}']`
      });
    },

    validatePerformanceFilter: (item, context) => {
      const value = item.performanceFilter;
      
      const knownAccounts = getGlobalsSheet().getAccounts();
      const validKeys = ['none', ...Object.keys(knownAccounts)];

      const result = validKeys.includes(value);

      validationResult.record(result, {
        ...context,
        prop: 'performanceFilter',
        level: ERROR,
        message: `Unexpected value for performanceFilter (${value}) - expected one of ['${validKeys.join("', '")}']`
      });
    },

    validateDateSameAs: (item, context) => {
      const value = item.dateSameAs;
      funcs.validateSameAs(value, { ...context, prop: 'dateSameAs' });
    },

    validateDataSetSameAs: (item, context) => {
      const value = item.dataSetSameAs;
      funcs.validateSameAs(value, { ...context, prop: 'dataSetSameAs' });
    },

    validateSameAs: (value, context) => {
      const secNum = parseInt(value, 10);

      let result = !isNaN(secNum);
      result = result && secNum >= 1 && secNum <= 4;

      validationResult.record(result, {
        ...context,
        level: ERROR,
        message: `Unexpected value for ${context.prop} (${value}) - expected a section number between 1 and 4 inclusive`
      });

      if (result) {
        result = secNum !== context.secNum;

        validationResult.record(result, {
          ...context,
          level: ERROR,
          message: `Unexpected value for ${context.prop} (${value}) - item references itself`
        });
      }
    },

    validateTaxYear: (item, context) => {
      const value = item.taxYear;
      let result = taxYearRe.test(value);

      if (result) {
        const matches = value.match(taxYearRe);

        const firstYear = parseInt(matches[1], 10);
        const secondYear = parseInt(matches[2], 10);

        result = isNumber(firstYear) && isNumber(secondYear);
        
        if (result) {
          result = firstYear + 1 === secondYear;
          result = result && firstYear >= 22 && secondYear <= (new Date().getFullYear() - 2000);
        }
      }
    
      validationResult.record(result, {
        ...context,
        prop: 'taxYear',
        level: ERROR,
        message: `Unexpected value for taxYear (${value}) - expected a consecutive short year (slash) short year (e.g. 24/25)`
      });
    },

    validateStartDate: (item, context) => {
      const value = item.startDate;
      funcs.validateIsDate(value, { ...context, prop: 'startDate' });
    },

    validateEndDate: (item, context) => {
      const value = item.endDate;
      funcs.validateIsDate(value, { ...context, prop: 'endDate' });
    },

    getDateParts: (value) => {
      const parts = (value + '').split('-');

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return;
      }

      return { year, month, day };
    },

    validateIsDate: (value, context) => {
      const parts = funcs.getDateParts(value);
      const year = parts?.year;
      const month = parts?.month;
      const day = parts?.day;

      let result = isNumber(year) && isNumber(month) && isNumber(day);
      
      validationResult.record(result, {
        ...context,
        level: ERROR,
        message: `Unexpected value for ${context.prop} (${isEmpty(value) ? 'empty' : value}) - expected a date similar to 2025-09-19 (Sept 19, 2025)`
      });

      if (result) {
        const date = new Date(year, month - 1, day);
        const earliest = getGlobalsSheet().getEarliest();
        const latest = getGlobalsSheet().getLatest();

        result = date > earliest && date <= latest;

        validationResult.record(result, {
        ...context,
        level: ERROR,
        message: `${context.prop} (${value}) is outside of valid range [${formatToYYYYMMDD(earliest)} -> ${formatToYYYYMMDD(latest)}]`
      });
      }
    },

    validateOffsetPeriod: (item, context) => {
      const value = item.offsetPeriod;
      const result = offsetPeriodRe.test(value);

      validationResult.record(result, {
        ...context,
        prop: 'offsetPeriod',
        level: ERROR,
        message: `Unexpected value for offsetPeriod (${value}) - expected a number followed by day, days, week, weeks etc.`
      });
    },

    validateOneLineData: (line, context) => {
      switch (line.dataSetLineMode) {
        case 'all':
          // nothing to validate
          break;   
        case 'account':
          funcs.validateAccount(line, context);
          break;
        case 'holding':
          funcs.validateSymbols(line, context);
          break;
        default:
          throw new Error(`Unknown dataSetLineMode "${line.dataSetLineMode}"`);
      }
    },

    validateAccount: (line, context) => {
      const account = line.account;
      const knownAccounts = getGlobalsSheet().getAccounts();
      const knownAccountKeys = Object.keys(knownAccounts);

      const result = knownAccountKeys.includes(account);

      validationResult.record(result, {
        ...context,
        prop: 'account',
        level: ERROR,
        message: `Unexpected value for account (${account}) - expected one of ['${knownAccountKeys.join("', '")}']`
      });
    },

    validateSymbols: (line, context) => {
      const symbols = line.symbols;
      const knownSymbols = getCombinedStockTransactionHistorySheet().getSymbols();
      
      if (!isArray(symbols)) {
        validationResult.record(false, {
          ...context,
          prop: 'symbols',
          level: ERROR,
          message: `Expected symbols to be an array, got ${typeof symbols}`
        });

        return;
      }

      //const knownAccountKeys = Object.keys(knownAccounts);

      validationResult.record(symbols.length > 0, {
        ...context,
        prop: 'symbols',
        level: ERROR,
        message: `Unexpected value for symbols ([empty]) - expected at least 1 symbol to be selected`
      });  

      symbols.forEach(symbol => { 
        const result = knownSymbols.includes(symbol);
        
        validationResult.record(result, {
          ...context,
          prop: 'symbols',
          level: ERROR,
          message: `Unexpected value for symbols (${symbol}) - unknown symbol`
        });
      });
    }
  }

  return { 
    validate: (data) => {
      funcs.validateAll(data);
      return validationResult.getResult();
    },

    getConstants: () => ({ ERROR, WARN, OK })
  };
}
