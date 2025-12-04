
const refreshStockGrowthFactorSnapshotSheet = () => {
  stockGrowthFactorSnapshotSheet.refresh();
}

const stockGrowthFactorSnapshotSheet = (() => {
  
  const STOCK_GROWTH_FACTOR_SNAPSHOT_SHEETNAME = 'Stock Growth Factor Snapshot'
  
  const funcs = {
    refresh: () => {
      
      const startTime = new Date();

      const helper = makeHelper(STOCK_GROWTH_FACTOR_SNAPSHOT_SHEETNAME);
      const [{ 
        topLeftPosition,
        lastUpdated,
        executionTime,
      }] = initMagicCoordinates(helper.getRange(1, 1, 1, 100), { 
        topLeftPosition: 'topLeftPosition',
        lastUpdated: 'lastUpdated',
        executionTime: 'executionTime' 
      });

      const earliestDate = getGlobalsSheet().getEarliest();
      
      const latestDate = getGlobalsSheet().getLatest(); 
      const csthSheet = getCombinedStockTransactionHistorySheet();
      const symbols = csthSheet.getSymbols();
      const symbolCurrencyMap = symbols.reduce((acc, symbol) => {
        acc[symbol] = stockPriceReader.getCurrencyOf(symbol);
        return acc;
      }, {});

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
      
      const result = openingDates.map((opening) => {
        
        const closing = setTime(opening, 18); // set to 18:00
        if (opening.getHours() !== 0) {
          let sadfasfsadfa = 0;
        }
        const totalOpeningValue = { };
        const totalValueChange = { };
        
        symbols.forEach((symbol) => {
          const currency = symbolCurrencyMap[symbol];
          
          const quantity = Math.min(
            csthSheet.getHoldingQuantityAsOf(symbol, opening),
            csthSheet.getHoldingQuantityAsOf(symbol, closing)
          );

          const openingPrice = stockPriceReader.getPriceOn(symbol, opening);
          const closingPrice = stockPriceReader.getPriceOn(symbol, closing);

          const openingValue = (quantity * openingPrice);
          const closingValue = (quantity * closingPrice);

          //const priceChange = (closingPrice / openingPrice) - 1;
          const valueChange = closingValue - openingValue;

          totalOpeningValue[currency] = (totalOpeningValue[currency] || 0) + openingValue;
          totalValueChange[currency] = (totalValueChange[currency] || 0) + valueChange;
        });

        return {
          date: closing,
          exchangeRate: exchangeRatesReader().getRateOn('USD', 'GBP', closing),
          openingValues: totalOpeningValue,
          valueChanges: totalValueChange
        }
      });

      /****************************************
       * CURRENCIES VALIDATION
       */
      const currencies = Object.keys(result[0].openingValues).sort().reverse();
      if (currencies.length !== 2) {
        // It's highly unlikely that I'll ever hold more than USD or GBP so I'm not going to go overboard with being dynamic
        // ... but we don't want to destroy data on the sheet if I ever do expand
        throw new Error(`Writing to the sheet expects 2 currencies at most. Found ${currencies.length} currencies.`)
      }

      /****************************************
       * REMOVE EMPTY DATA (i.e. 0 holdings)
       */
      let spliceIndex = -1;
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

      /****************************************
       * UPDATE THE PERFORMANCE METRICS
       */
      const endTime = new Date();
      const elapsedTime = (endTime.valueOf() - startTime.valueOf())/1000;

      const optionsWithTime = {
        year: 'numeric',
        month: 'short',     // Abbreviated month (e.g., 'Dec')
        day: 'numeric',
        hour: '2-digit',    // Two-digit hour (e.g., '05')
        minute: '2-digit',  // Two-digit minute (e.g., '18')
        hour12: false        // Use 12-hour clock with AM/PM
      };

      helper.getRange(
        lastUpdated.col, lastUpdated.row
      ).setValue(
        (new Date()).toLocaleDateString('en-GB', optionsWithTime)
      )

      helper.getRange(
        executionTime.col, executionTime.row
      ).setValue(`${Math.round(elapsedTime)}s`);
    }
  }
  
  return funcs;

})();


