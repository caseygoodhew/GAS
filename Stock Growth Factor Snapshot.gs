
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

        const exchangeRate = exchangeRatesReader().getRateOn(currency, 'GBP', closing);

        if (index1 > 0) { perfStats.push(perf.check().value) }

        const openingValue = (quantity * openingPrice);
        const closingValue = (quantity * closingPrice);

        const valueChange = closingValue - openingValue;

        return {
          symbol,
          account: symbolAccountMap[symbol],
          currency,
          exchangeRate,
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
            groups[key].openingValue += item.openingValue;
            groups[key].valueChange += item.valueChange;
            groups[key].factor = groups[key].openingValue === 0 ? 0 : (groups[key].valueChange * 1000) / groups[key].openingValue;
            return groups;

          }, {});
          
          return { date, groups };
        });

        return { ...metadata, keys: allKeys, items: grouped };
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

        const takeDates = (source) => {
          return source.map(({ date }) => date);
        }

        /****************************************
        * MERGE
        */
        const items = takeDates(groups[0].items).map((date, recordIndex) => {
          const values = allKeys.reduce((acc, { key, groupIndex }) => {
            const valueIndex = structure[groupIndex].keyMap[key];
            const valueSet = groups[groupIndex].items[recordIndex].groups[key];
            acc[valueIndex] = { ...valueSet };
            return acc;
          }, []);
          
          return { date, values };
        })
        
        return { structure, items };
      }

      const groups = mergeGrowthFactorGroups(
        calculateGrowthFactorBy({ label: 'All', out: ['factor'] }, () => 'All'),
        calculateGrowthFactorBy({ label: 'Account', out: ['factor'] }, (item) => item.account),
        //calculateGrowthFactorBy('Currency', (item) => item.currency),
        calculateGrowthFactorBy({ label: 'Symbol', out: ['openingValue', 'valueChange'] }, (item) => item.symbol),
      );


      /****************************************
       * REMOVE EMPTY DATA (i.e. 0 holdings)
       */
      let spliceIndex = -1;
      let foundValueSetData = groups.items[0].values.map(() => false);
      let everFoundValueSetData = false;

      for (let i = groups.items.length - 1; i >=0; i--) {
        let foundDataThisLoop = everFoundValueSetData;
        
        for (let v = 0; v < groups.items[i].values.length; v++) {
          const valueSet = groups.items[i].values[v];
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
        groups.items.splice(spliceIndex, groups.items.length - spliceIndex);
      }

      performance.log();

throw new Error('STILL NEED TO REVIEW EVERYTHING BELOW THIS LINE TO WORK WITH UPDATES')

      
      /****************************************
       * REMOVE EMPTY DATA (i.e. 0 holdings)
       */
      // remove the data before investments are found
      for (let i = result.length - 1; i >=0; i--) {
        let usdIsEmpty = false;
        let gbpIsEmpty = false;

        if (result[i].openingValues.USD === 0) {
          result[i].openingValues.USD = null;
          result[i].valueChanges.USD = null;
          usdIsEmpty = true;
        }

        if (result[i].openingValues.GBP === 0) {
          result[i].openingValues.GBP = null;
          result[i].valueChanges.GBP = null;
          gbpIsEmpty = true;
        }

        if (usdIsEmpty && gbpIsEmpty) {
          spliceIndex = i;
        }

        if (!usdIsEmpty && !gbpIsEmpty) {
          break;
        }
      }

      if (spliceIndex >= 0) {
        result.splice(spliceIndex, result.length - spliceIndex);
      }

      /****************************************
       * CLEAR THE EXISTING DATA
       */
      const resultSize = {
        fixedCols: 2
      }
      resultSize.rows = result.length;
      resultSize.cols = resultSize.fixedCols + 3 * (currencies.length);
      
      helper.getRange(
        topLeftPosition.col, 
        topLeftPosition.row, 
        topLeftPosition.col + resultSize.cols - 1, 
        Math.max(helper.getLastRow(), topLeftPosition.row)
      ).clearContent();

      /****************************************
       * ENSURE WE HAVE ENOUGH SPACE
       */
      
      if (helper.getMaxRows() < topLeftPosition.row + resultSize.rows) {
        helper.insertRows(helper.getMaxRows(), topLeftPosition.row + resultSize.rows - helper.getMaxRows());
      }

      if (helper.getMaxColumns() < topLeftPosition.col + resultSize.cols) {
        helper.insertColumns(helper.getMaxColumns(), topLeftPosition.col + resultSize.cols - helper.getMaxColumns());
      }

      /****************************************
       * INSERT THE VALUES
       */
      helper.getRange(
        topLeftPosition.col, 
        topLeftPosition.row, 
        topLeftPosition.col + resultSize.cols - 1, 
        topLeftPosition.row + resultSize.rows - 1
      ).setValues(result.map(item => {
        return [
          item.date, 
          item.exchangeRate,
          ...currencies.map(currency => {
            return [
              item.openingValues[currency],
              item.valueChanges[currency],
              null // we'll insert the formula here afterwards
            ];
          }).flat()
        ];
      }));

      /****************************************
       * RECREATE THE FORMULAS
       */
      currencies.forEach((_, index) => {
        const colNum = (topLeftPosition.col - 1) + resultSize.fixedCols + (index * 3) + 3;
        const dividendAddress = `${toColLetter(colNum - 1)}${topLeftPosition.row}`;
        const divisorAddress = `${toColLetter(colNum - 2)}${topLeftPosition.row}`;
        const formula = `=IF(ISBLANK(${divisorAddress}), ${divisorAddress}, IF(${divisorAddress}=0, 0, ${dividendAddress}/${divisorAddress}))`;
        
        helper.getRange(
          colNum, 
          topLeftPosition.row, 
          colNum, 
          topLeftPosition.row + resultSize.rows - 1
        ).setFormula(formula);
      })

      performance.stop();
    }
  }
  
  return funcs;

})();


