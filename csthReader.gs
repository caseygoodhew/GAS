const readCombinedStockTransactionHistorySources = (csthColumns, constants) => {
  
  const exec = () => {
  
    /*const csData = readStockHistory(
      charlesSchwabTransactionHistoryReaderConfig(csthColumns, constants)
    );
*/
    const t212Data = readStockHistory(
      trading212TransactionHistoryReaderConfig(csthColumns, constants)
    );
    
    return [].concat(csData, t212Data);
  }

  const readStockHistory = ({ sheetName, layout, preProcess, process, postProcess }) => {
    
    /***********************************
     * SETUP
     **********************************/
    // we assume that the first data happens on row 3 (HEADING, heading, data...)
    const firstDataRow = 3;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    const columns = initLabelledColumns(sheet, layout.columns);
    const helper = makeHelper(sheet, columns)

    /***********************************
     * CONVERT DATA TO JSON
     **********************************/
    const dataRange = helper.getRange(
      columns.first,
      firstDataRow, 
      columns.last,
      sheet.getLastRow(),
    );

    let data = helper.getRowValues(dataRange).map(row => {
      return layout.columns.reduce((acc, colLabel) => {
        acc[colLabel] = row[columns.colLabelToNumMap[colLabel] - 1];
        return acc;
      }, {});
    });
    
    /***********************************
     * RUN PRE-PROCESSORS
     **********************************/
    data = (preProcess || []).reduce((data, {fn}) => fn(data), data);
    
    /***********************************
     * RUN PROCESSORS
     **********************************/
    
    processKeys = Object.keys(process);
    data = data.map(item => {
      return processKeys.reduce((result, key) => {
        const config = process[key];

        // SOURCE_ID_COL: toKeyCase('EVENT ID'),
        if (typeof config === 'string') {
          result[key] = item[config];
          return result;
        } 

        if (Object.prototype.toString.call(config) !== '[object Object]') {
          throw new Error(`Expected value of process.${key} to either be a String (key) or a config object`)
        }

        // SOURCE_SHEET_COL: {
        //   fn: () => sheetName,
        // },
        if (config.from === undefined) {
          result[key] = config.fn(item);

        

        // [FEES]: {
        //   from: [
        //    toKeyCase('Stamp duty'),
        //    toKeyCase('Stamp duty reserve tax'),
        //    toKeyCase('Ptm levy'),
        //   ]
        } else if (Array.isArray(config.from)) {
          const args = config.from.map(key => item[key]);
          result[key] = config.fn(...args, item);

        // TAX_YEAR_COL: {
        //   from: toKeyCase('Date'),
        //   fn: (date) => {} // calc the tax year
        // },
        } else {
          result[key] = config.fn(item[config.from], item);
        }

        return result;

      }, {})
    })

    /***********************************
     * RUN POST-PROCESSORS
     **********************************/
    data = (postProcess || []).reduce((data, {fn}) => fn(data), data);

    /***********************************
     * VALIDATE DATA QUALiTY
     **********************************/
    // Validate that only known columns have been created
    const expectedKeys = [].concat(csthColumns.keys).sort().join(', ');
    data.forEach(item => {
      const actualKeys =  Object.keys(item).sort().join(', ');
      if (actualKeys !== expectedKeys) {
        throw new Error(`Error porcessing ${sheetName}: Expected object to contain keys (${expectedKeys}), actually contains ${actualKeys}`);
      }
    })

    const validators = {
      isString: (value) => {
        if (typeof value !== 'string') {
          return 'is not a string';
        }
      },
      isDate: (value) => {
        if (!(value instanceof Date && !isNaN(value.valueOf()))) {
          return 'is not a Date object';
        }
      },
      isRegex: (re) => (value) => {
        if (!re.test(value)) {
          return `does not match RegEx (${re})`;
        }
      },
      isOneOf: (valids) => (value) => {
        if (!valids.includes(value)) {
          return `expected one of ${valids.join(', ')}`;
        }
      },
      isPositiveNumberOrEmpty: (value) => {
        // is empty check
        if (typeof value === 'string' && value.length === 0) {
          return;
        }
        
        if (!(typeof value === "number" && value >= 0)) {
          return `expected a positive number`;
        }
      },
    }

    const dataTypeValidation = {
      'SOURCE_ID': validators.isString,
      'SOURCE_SHEET': validators.isString,
      'DATE': validators.isDate,
      'TAX_YEAR': validators.isRegex(/^[0-9][0-9]\/[0-9][0-9]$/),
      'ACTION': validators.isOneOf(Object.values(constants.actions)),
      'SYMBOL': validators.isString,
      'QUANTITY': validators.isPositiveNumberOrEmpty,
      'SHARE_PRICE': validators.isPositiveNumberOrEmpty,
      'FEES': validators.isPositiveNumberOrEmpty,
      'AMOUNT': validators.isPositiveNumberOrEmpty,
      'CURRENCY': validators.isRegex(/^[A-Z][A-Z][A-Z]$/)
    };

    const devValidationHasAllKeys = Object.keys(dataTypeValidation).sort().join(', ');
    if (devValidationHasAllKeys !== expectedKeys) {
      throw new Error(`Dev Error: dataTypeValidation does not match column names`);
    }
    
    // Validate that each column only contains expected data types
    data.forEach(item => {
      csthColumns.keys.forEach(key => {
        const result = dataTypeValidation[key](item[key]);
        if (result) {
          throw new Error(`Error porcessing ${sheetName}: Data validation failed for ${key} (${item[key]}) with message "${result}"`);
        }
      });
    })

    return data;
  }

  return exec();
}
