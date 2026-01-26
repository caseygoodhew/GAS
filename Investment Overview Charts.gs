const testLocalIOCSetCurrentConfiguration = () => {
  testIOCSetCurrentConfiguration();
};

const testOnTimePeriodChange = () => {
  const helper = makeHelper(investmentOverviewChartsSheet().getSheetName());
  investmentOverviewChartsSheet().onTimePeriodChange({range: helper.getRange('D', 5)});
}

let memoizedInvestmentOverviewChartsSheet;
const investmentOverviewChartsSheet = () => {
  
  if (memoizedInvestmentOverviewChartsSheet) {
    return memoizedInvestmentOverviewChartsSheet;
  }

  const INVESTMENT_OVERVIEW_CHARTS_SHEETNAME = 'Investment Overview Charts';
  const helper = makeHelper(INVESTMENT_OVERVIEW_CHARTS_SHEETNAME);
  const [magicCoordinates] = initMagicCoordinates(helper.getRange(1, 1, 2, 100), { 
    chartDataTopLeft: 'chartDataTopLeft',
    currentChartConfig: 'currentChartConfig',
    chartConfigPresets: 'chartConfigPresets'
  });

  const {
    chartDataTopLeft,
    currentChartConfig,
    chartConfigPresets
  } = magicCoordinates;

  const makeTimespanFormula = (amount, period) => {
    const referenceCell = toA1Notation(startDate.col, startDate.row);
    switch (period.toLowerCase()) {
      case 'day':
      case 'days':
        return `=${referenceCell}-${amount}`;
      
      case 'week':
      case 'weeks':
        return `=${referenceCell}-(${amount} * 7)`;
      
      case 'month':
      case 'months':
        return `=EDATE(${referenceCell}, -${amount})`;
      
      case 'year':
      case 'years':
        return `=EDATE(${referenceCell}, (-${amount} * 12))`;
    }
  }

  let memoizedRanking = {};
  const getMemoizedRanking = (dateRange, line) => {
    const memoKey = [
      dateRange[0].toString(), 
      dateRange[dateRange.length - 1].toString(),
      line.limit
    ].join('|');

    if (memoizedRanking[memoKey]) {
      return [...memoizedRanking[memoKey]];
    }
      
    /** GET THE SYMBOLS TO BE RANKED **/
    const symbols = ((limit) => {
      switch (limit) {
        case 'all':
          return Object.keys((getCombinedStockTransactionHistorySheet().getAccountSymbolMap(
            getCombinedStockTransactionHistorySheet().SYMBOLS
          )));
        default:
          // the only other option (for now) is that this is an account
          return getCombinedStockTransactionHistorySheet().getAccountSymbolMap(
            getCombinedStockTransactionHistorySheet().ACCOUNTS
          )[limit];
      }
    })(line.limit);

    /** DO THE RANKING **/
    const map = symbols.reduce((acc, symbol) => ({ ...acc, [symbol]: 0 }), {});
    dateRange.forEach((date, index) => {
      if (index === 0) {
        return;
      }

      const item = stockGrowthFactorSnapshotSheet().getDataOn(date);
      
      symbols.forEach(symbol => {
        const factor = stockGrowthFactorSnapshotSheet().calculateFactor(
          [item.symbol[symbol]]
        )

        map[symbol] += factor;
      })
    })

    const ranked = symbols
      // if it's exactly 0, we can 
      .filter(symbol => map[symbol] !== 0)
      .map((symbol => ({ symbol, value: map[symbol] })))
      .sort((a, b) => b.value - a.value);

    memoizedRanking[memoKey] = ranked;
    return [...ranked];
  }

  let memoizedConfiguration;

  const funcs = {
    getSheetName: () => {
      return INVESTMENT_OVERVIEW_CHARTS_SHEETNAME;
    },
    getMagicCoordinates: () => {
      throw new Error('check if getMagicCoordinates should be deprecated')
      return magicCoordinates;
    },
    storeConfiguration: (data) => {
      helper.getRange(currentChartConfig.col, currentChartConfig.row).setValue(JSON.stringify(data));
      memoizedConfiguration = data;
    },
    loadConfiguration: () => {
      if (!memoizedConfiguration) {
        const value = helper.getRange(currentChartConfig.col, currentChartConfig.row).getValue();
        
        const json = value == '' ? {} : JSON.parse(`{ "value": ${value} }`);
        memoizedConfiguration = json.value;
      }
      return memoizedConfiguration;
    },
    updateCharts: data => {
      /*. this writes the dates in place - not sure if this will stay or not */
      //const dateValues = pivotArray(data.map(item => [item.startDate, item.endDate]));
      //helper.getRangeBySize(dateRangeStart.col, dateRangeStart.row, 4, 2).setValues(dateValues);

      const sets = data.map(({startDate, endDate, data: lines}) => {
        const minDate = Math.min(new Date(startDate), new Date(endDate));
        const maxDate = Math.max(new Date(startDate), new Date(endDate));

        const dateRange = [];
        for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
          // as this is an accumulation chart, the sheet will not provide data for days where no readings
          // are available (i.e. due to recency or non-trading day)
          if (stockGrowthFactorSnapshotSheet().getDataOn(d)) {
            dateRange.push(new Date(d));
          }
        }
        if (!dateRange.length) {
          debugger;
        }

        const lineData = lines.map(line => {
          switch (line.mode) {
            case 'all':
              return { 
                description: 'All (in GBP)',
                data: dateRange.map(date => {
                  const item = stockGrowthFactorSnapshotSheet().getDataOn(date);
                  return item.all.factor;
                })
              };
            case 'account':
              return {
                description: line.account,
                data: dateRange.map(date => {
                  const item = stockGrowthFactorSnapshotSheet().getDataOn(date);
                  return item.account[line.account].factor;
                })
              };
            case 'holding':
              return {
                description: line.symbols.join(','),
                data: dateRange.map(date => {
                  const item = stockGrowthFactorSnapshotSheet().getDataOn(date);
                  
                  return stockGrowthFactorSnapshotSheet().calculateFactor(
                    line.symbols.map(symbol => item.symbol[symbol])
                  )
                })
              };
            case 'performance':
              const ranked = getMemoizedRanking(dateRange, line);
              if (line.ordinance === 'bottom') {
                ranked.reverse();
              }
              
              const rankedSymbols = ranked.slice(0, 4).map(x => x.symbol);

              return {
                description: rankedSymbols[line.rank - 1],
                data: dateRange.map(date => {
                  const item = stockGrowthFactorSnapshotSheet().getDataOn(date);
                  
                  return stockGrowthFactorSnapshotSheet().calculateFactor(
                    [item.symbol[rankedSymbols[line.rank - 1]]]
                  )
                })
              }; 
            default:
              throw new Error(`Error updating charts - unknown data mode "${line.mode}"`);
          }
        });

        const one = lineData.map(x => {
          let currentSum = 0;
          return [
            0, 
            ...x.data.slice(1).map(value => (currentSum += value)/10)
          ]
        });

        const two = [dateRange, ...one];
        const three = pivotArray(two);
        const four = [['Date', ...lineData.map(x => x.description)], ...three];

        return four;
      });

      const firstCol = chartDataTopLeft.col;
      const firstRow = chartDataTopLeft.row;
      helper.getRange(firstCol, firstRow, helper.getLastColumn(), helper.getLastRow()).clearContent();
      
      sets.forEach((out, index) => {
        helper.getRangeBySize(firstCol + (index * 6), firstRow, out[0].length, out.length).setValues(out);
      });
    },
    onTimePeriodChange: ({range}) => {
      throw new Error('check if onTimePeriodChange should be deprecated')
      const periodValue = range.getValue();

      if (periodValue === 'Custom') {
        return;
      }

      const re = /^([0-9]+) (day|days|week|weeks|month|months|year|years)$/i
      if (!re.test(periodValue)) {
        throw new Error(`Could not parse value from range (${value})`)
      }

      const matches = periodValue.match(re);
      const formula = makeTimespanFormula(matches[1], matches[2]);

      helper.getRange(endDate.col, endDate.row).setFormula(formula);
      
      const startDateRange = helper.getRange(startDate.col, startDate.row)
      const startDateValue = startDateRange.getValue();
      if (!isDate(startDateValue)) {
        startDateRange.setValue(new Date());
      }
    },
  }
  
  memoizedInvestmentOverviewChartsSheet = funcs;
  return funcs;
};


