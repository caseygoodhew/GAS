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
    dateRangeStart: 'dateRangeStart',
    /*periodPicker: 'periodPicker',
    startDate: 'startDate',
    endDate: 'endDate',*/
    currentChartConfig: 'currentChartConfig',
    chartConfigPresets: 'chartConfigPresets'
  });

  const {
    dateRangeStart,
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
      const dateValues = pivotArray(data.map(item => [item.startDate, item.endDate]));

      //throw new Error(JSON.stringify(data, undefined, 2))

      helper.getRangeBySize(dateRangeStart.col, dateRangeStart.row, 4, 2).setValues(dateValues);
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


