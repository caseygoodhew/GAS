
const refreshStockGrowthFactorSnapshotSheet = () => {
  stockGrowthFactorSnapshotSheet.refresh();
}


const stockGrowthFactorSnapshotSheet = (() => {
  
  const STOCK_GROWTH_FACTOR_SNAPSHOT_SHEETNAME = 'Stock Growth Factor Snapshot'

  const getValidatedSymbolAccountMap = () => {
    const csthSheet = getCombinedStockTransactionHistorySheet();
    const symbols = csthSheet.getSymbols();
    const accounts = Object.values(csthSheet.getConstants().accounts);
    const result = csthSheet.getAccountSymbolMap();

    return Object.keys(result).reduce((acc, key) => {
      if (accounts.includes(key)) {
        return acc;
      }

      if (!symbols.includes(key)) {
        throw new Error(`Expected ${key} to either be a known symbol or account`);
      }

      if (result[key].length > 1) {
        throw new Error(`Expected ${symbol} to be used in only 1 account (maps to [${result[key].join(', ')}])`);
      }

      acc[key] = result[key][0];
      return acc;
    }, {});
  }

  let memoizedPreprocessedData;
  const getPreprocessedDataFromCombinedStockTransactionHistorySheet = () => {
    if (memoizedPreprocessedData) {
      return memoizedPreprocessedData;
    }

    const latestDate = getGlobalsSheet().getLatest(); 
    const earliestDate = getGlobalsSheet().getEarliest();
    //const earliestDate = addDays(latestDate, -30);
    const csthSheet = getCombinedStockTransactionHistorySheet();
    const symbols = csthSheet.getSymbols();
    const symbolCurrencyMap = symbols.reduce((acc, symbol) => {
      acc[symbol] = stockPriceReader.getCurrencyOf(symbol);
      return acc;
    }, {});
    let symbolAccountMap = getValidatedSymbolAccountMap();

    const openingDates = [];
    
    for (let date = addDays(latestDate, -1); date >= earliestDate; date = addDays(date, -1)) {
      if (date.getDay() > 0 && date.getDay() < 6) {
        // We'll say that the market opens at 5am so that we can avoid nastiness with daylight savings shifts 
        // if we used midnight as the start point. (Sheets ignores TZ, js uses it by default)
        openingDates.push(setTime(date, 5));
      }
    }

    // discard the last one to avoid rate lookup conflicts
    openingDates.pop();
    const perfStats = [];
    const data = openingDates.map((opening, index1) => {
      const closing = setTime(opening, 18); // set to 18:00
      const perf = performanceStats().start();
      
      const items = symbols.map((symbol, index2) => {

        const perf = performanceStats().start();
        const currency = symbolCurrencyMap[symbol];
        
        const quantity = Math.min(
          csthSheet.getHoldingQuantityAsOf(symbol, opening),
          csthSheet.getHoldingQuantityAsOf(symbol, closing)
        );
        
        const openingPrice = stockPriceReader.getPriceOn(symbol, opening);
        const closingPrice = stockPriceReader.getPriceOn(symbol, closing);

        if (index1 > 0) { perfStats.push(perf.check().value) }

        const openingValue = (quantity * openingPrice);
        const closingValue = (quantity * closingPrice);

        const valueChange = closingValue - openingValue;

        return {
          symbol,
          account: symbolAccountMap[symbol],
          currency,
          openingValue,
          valueChange,
        }
      });

      return { date: closing, items }
    });

    const avg = perfStats.reduce((sum, val) => sum + val, 0) / perfStats.length

    memoizedPreprocessedData = data;
    return memoizedPreprocessedData;
  }

  // this reasonably assumes that the dates are all the same as they are sourced from the same dataset
  const mergeGrowthFactorGroups = (...groups) => {
    
    /****************************************
    * VALIDATION
    */
    if (!groups.length) {
      throw new Error(`Expected at least 1 group, received none`)
    }

    const expectedLength = groups[0].items.length;
    groups.forEach(group => {
      if (group.items.length !== expectedLength) {
        throw new Error(`Expected all groups to contain the same number of records`)
      }
    });

    for (let j = 1; j < expectedLength; j++) {
      for (let i = 1; i < groups.length; i++) {
        const expectedDate = groups[0].items[j].date;
        if (groups[i].items[j].date !== expectedDate) {
          throw new Error(`Expected all groups to have the same date at each position / index`)
        }
      }
    }
    
    /****************************************
    * SETUP
    */
    const allKeys = [];
    
    const structure = groups.map((group, groupIndex) => {
      const struct = {...group};
      delete struct.items;
      
      struct.keyMap = struct.keys.reduce((acc, key) => {
        acc[key] = allKeys.length;
        allKeys.push({ key, groupIndex });
        return acc;
      }, {});
      
      return struct;
    });

    /****************************************
    * MERGE
    */
    
    const items = groups[0].items
      // takes just the dates from the first group
      .map(({ date }) => date)
      .map((date, recordIndex) => {
        const values = allKeys.reduce((acc, { key, groupIndex }) => {
          const valueIndex = structure[groupIndex].keyMap[key];
          const valueSet = groups[groupIndex].items[recordIndex].groups[key];
          acc[valueIndex] = { ...valueSet };
          return acc;
        }, []);
        
        return { date, values };
      })
    
    return { structure, items: removeEmptyData(items) };
  }

  const calculateGrowthFactorBy = (metadata, keyFn) => {
    const data = getPreprocessedDataFromCombinedStockTransactionHistorySheet();
    const allKeys = [];

    const grouped = data.map(({ date, items }) => {
      
      const groups = items.reduce((groups, item) => {
        const key = keyFn(item);
        if (!allKeys.includes(key)) {
          allKeys.push(key);
        }
        groups[key] = groups[key] || { openingValue: 0, valueChange: 0 };
        
        const exchangeRate = metadata.toCurrency ? exchangeRatesReader().getRateOn(item.currency, 'GBP', date) : 1;
        
        groups[key].openingValue += (item.openingValue * exchangeRate);
        groups[key].valueChange += (item.valueChange * exchangeRate);
        groups[key].factor = groups[key].openingValue === 0 ? 0 : (groups[key].valueChange * 1000) / groups[key].openingValue;

        return groups;

      }, {});
      
      return { date, groups };
    });

    return { ...metadata, keys: allKeys, items: grouped };
  }

  /****************************************
   * REMOVE EMPTY DATA (i.e. 0 holdings)
   */
  const removeEmptyData = (items) => {
    let spliceIndex = -1;
    let foundValueSetData = items[0].values.map(() => false);
    let everFoundValueSetData = false;

    for (let i = items.length - 1; i >=0; i--) {
      let foundDataThisLoop = everFoundValueSetData;
      
      for (let v = 0; v < items[i].values.length; v++) {
        const valueSet = items[i].values[v];
        if (!foundValueSetData[v] && valueSet.openingValue === 0) {
          valueSet.openingValue = null;
          valueSet.valueChange = null;
          valueSet.factor = null;
        } else {
          foundValueSetData[v] = true;
          foundDataThisLoop = true;
          everFoundData = true;
        }
      }

      if (!foundDataThisLoop) {
        spliceIndex = i;
      }
    }
    
    if (spliceIndex >= 0) {
      items.splice(spliceIndex, items.length - spliceIndex);
    }

    return items;
  }




  
  const funcs = {
    refresh: () => {

      const helper = makeHelper(STOCK_GROWTH_FACTOR_SNAPSHOT_SHEETNAME);
      const [{ 
        topLeftPosition,
        datestampCell,
        elapsedTimeCell,
      }] = initMagicCoordinates(helper.getRange(1, 1, 1, 100), { 
        topLeftPosition: 'topLeftPosition',
        lastUpdated: 'datestampCell',
        executionTime: 'elapsedTimeCell' 
      });

      const performance = performanceStats({ helper, datestampCell, elapsedTimeCell }).start();

      const blues = colorArray('#c9daf8', .3, 3);
      const greens = colorArray('#d9ead3', .3, 3);
      const purples = colorArray('#d9d2e9', .3, 4);

      const groups = mergeGrowthFactorGroups(
        calculateGrowthFactorBy({ label: 'All', out: ['factor'], toCurrency: 'GBP', colors: blues }, () => 'All (GBP)'),
        calculateGrowthFactorBy({ label: 'Account', out: ['factor'], colors: greens }, (item) => item.account),
        //calculateGrowthFactorBy('Currency', (item) => item.currency),
        calculateGrowthFactorBy({ label: 'Symbol', out: ['openingValue', 'valueChange'], colors: purples }, (item) => item.symbol),
      );

      /****************************************
       * CLEAR THE EXISTING DATA
       */
      const resultSize = {
        cols: groups.structure.reduce((acc, item) => {
           return acc + item.out.length * item.keys.length;   
        }, 1 /* date column */ ),
        rows: groups.items.length
      }

      const headerRows = 3;
      const resultRange = {
        firstCol: topLeftPosition.col,
        firstRow: topLeftPosition.row,
        lastHeaderRow: topLeftPosition.row + headerRows - 1,
        firstDataRow: topLeftPosition.row + headerRows,
        lastCol: topLeftPosition.col + resultSize.cols - 1,
        lastRow: topLeftPosition.row + resultSize.rows + headerRows - 1
      }

      helper.getRange(
        topLeftPosition.col, 
        topLeftPosition.row, 
        Math.min(helper.getMaxColumns(), topLeftPosition.col + resultSize.cols - 1), 
        Math.min(helper.getMaxRows(), topLeftPosition.row + resultSize.rows - 1)
      ).clear();

      /****************************************
       * ENSURE WE HAVE ENOUGH SPACE
       */
      
      if (helper.getMaxRows() < resultRange.lastRow + 1) {
        helper.insertRows(helper.getMaxRows(), resultRange.lastRow - helper.getMaxRows() + 1);
      }

      if (helper.getMaxColumns() < resultRange.lastCol + 1) {
        helper.insertColumns(helper.getMaxColumns(), resultRange.lastCol - helper.getMaxColumns() + 1);
      }

      /****************************************
       * INSERT THE HEADERS
       */
      const fixedColHeaders = new Array(headerRows).fill('');
      fixedColHeaders[0] = "Date"

      const headerLabels = {
        factor: 'Factor',
        openingValue: 'Opening',
        valueChange: 'Change'
      }
      
      const headers = pivotArray(groups.structure.reduce((all, struct) => {
        const result = struct.keys.map(key => struct.out.map(out => {
          return [struct.label, key, headerLabels[out]];
        })).flat();
        
        return [...all, ...result];
      }, [fixedColHeaders]));

      helper.getRange(
        resultRange.firstCol, 
        resultRange.firstRow, 
        resultRange.lastCol, 
        resultRange.lastHeaderRow
      ).setValues(headers);
      
      /****************************************
       * INSERT THE VALUES
       */
      const values = groups.items.map(item => {
        
        const row = [item.date];

        groups.structure.forEach(struct => {
          struct.keys.forEach(key => {
            struct.out.forEach(prop => {
              row.push(
                item.values[struct.keyMap[key]][prop]
              );
            })
          })
        })
        
        return row;
      });

      helper.getRange(
        resultRange.firstCol, 
        resultRange.firstDataRow, 
        resultRange.lastCol, 
        resultRange.lastRow
      ).setValues(values);

      /****************************************
       * SET COLUMN FORMATTING
       */

      helper.getRange(
        resultRange.firstCol, 
        resultRange.firstDataRow, 
        resultRange.firstCol, 
        resultRange.lastRow
      ).setNumberFormat('d"-"mmm"-"yy').setFontWeight('bold');

      const formattingFns = {
        factor: (range) => range.setNumberFormat('#,##0.00'),
        openingValue: (range) => range.setNumberFormat('#,##0'),
        valueChange: (range) => range.setNumberFormat('#,##0')
      }

      const modifiedFormattingFnsMap = Object.keys(formattingFns).reduce((acc, key) => {
        acc[headerLabels[key]] = formattingFns[key];
        return acc;
      }, {});
      
      for (let i = 1; i < headers[headerRows - 1].length; i++) {
        const fn = modifiedFormattingFnsMap[headers[headerRows - 1][i]];
        if (!fn) {
          continue;
        }
        
        const range = helper.getRange(
          resultRange.firstCol + i, 
          resultRange.firstDataRow, 
          resultRange.firstCol + i, 
          resultRange.lastRow 
        );

        fn(range);        
      }

      // setup the "Date" cell
      helper.getRange(
        resultRange.firstCol, 
        resultRange.firstRow, 
        resultRange.firstCol,
        resultRange.firstRow+2
      ).setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .mergeVertically();

      // bold all 
      helper.getRange(
        resultRange.firstCol, 
        resultRange.firstRow, 
        resultRange.lastCol,
        resultRange.lastHeaderRow
      ).setFontWeight('bold')
      .setHorizontalAlignment('center');

      performance.stop();
      performance.log();
    
      let colIndex = 0;
      groups.structure.forEach(struct => {

        let counter = 0;
        for (let i = 0; i < struct.out.length * struct.keys.length; i++) {
          
          colIndex++;
          
          if (!struct.colors) {
            continue;
          }

          if (counter === struct.colors.length) {
            counter = 0;
          }

          helper.getRange(
            resultRange.firstCol + colIndex, 
            resultRange.firstRow, 
            resultRange.firstCol + colIndex, 
            resultRange.lastRow 
          ).setBackground(struct.colors[counter]);

          counter++;
        }
      });
    
    }

  }
  
  return funcs;

})();


