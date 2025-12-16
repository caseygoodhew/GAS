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
    periodPicker: 'periodPicker',
    startDate: 'startDate',
    endDate: 'endDate' 
  });
  const {startDate, endDate} = magicCoordinates;

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


  const funcs = {
    getSheetName: () => {
      return INVESTMENT_OVERVIEW_CHARTS_SHEETNAME;
    },
    getMagicCoordinates: () => {
      return magicCoordinates;
    },
    onTimePeriodChange: ({range}) => {
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


