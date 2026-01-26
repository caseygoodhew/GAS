const testProjectionsSheetGetData = () => {
  const data = projectionsSheet().getData();
  debugger;
}

let projectionsSheetMemoization = null;
const projectionsSheet = (() => {
  
  const PROJECTIONS_SHEETNAME = 'Projections'

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROJECTIONS_SHEETNAME);
  const columns = initLabelledColumns(sheet, [
    'WHO',
    'TYPE',
    'FROM_ACCOUNT',
    'TO_ACCOUNT',
    'START_DATE',
    'END_DATE',
    'RECURRENCE',
    'AMOUNT',
    'INTEREST_ON_ACCOUNT',
    'INTEREST_RATE'
  ]);

  const {
    INTEREST_ON_ACCOUNT,
    INTEREST_RATE
  } = columns;

  const interestCols = [INTEREST_ON_ACCOUNT, INTEREST_RATE];
  const dataCols = columns.keys.filter(key => !interestCols.includes(key))

  const helper = makeHelper(PROJECTIONS_SHEETNAME, columns);

  const transformData = (data) => {

    const firstDataCol = Math.min(...dataCols.map(key => columns.colLabelToNumMap[key]));

    const result = data.reduce((arr, row) => {
      // check if this is an empty (or merged "label") row that we can safely skip
      if (!row.slice(1).join('').length) {
        return arr;
      }

      return [...arr, row.reduce((acc, value, index) => {
          return { ...acc, [columns.colNumToLabelMap[firstDataCol + index]]: value }
        }, {})
      ]
    }, []);

    return result;
  }

  const transformInterestRates = (data) => {
    const firstInterestCol = Math.min(...interestCols.map(key => columns.colLabelToNumMap[key]));

    const result = data.reduce((arr, row) => {
      // check if this is an empty row that we can safely skip
      if (!row.join('').length) {
        return arr;
      }

      return [...arr, row.reduce((acc, value, index) => {
          return { ...acc, [columns.colNumToLabelMap[firstInterestCol + index]]: value }
        }, {})
      ]
    }, [])
    .map(item => ({ account: item[INTEREST_ON_ACCOUNT].trim(), rate: item[INTEREST_RATE] }))

    return result;
  }

  const memoizeAll = () => {
    if (projectionsSheetMemoization) {
      return;
    }

    const [{ topLeftPosition }] = initMagicCoordinates(
      helper.getRange(1, 1, 1, 100), 
      { topLeftPosition: 'topLeftPosition' }
    );

    const data = helper.getRange(
      Math.min(...dataCols.map(key => columns.colLabelToNumMap[key])), 
      topLeftPosition.row, 
      Math.max(...dataCols.map(key => columns.colLabelToNumMap[key])), 
      Math.max(helper.getLastRow(), topLeftPosition.row)
    ).getValues();

    const interestRates = transformInterestRates(helper.getRange(
      Math.min(...interestCols.map(key => columns.colLabelToNumMap[key])),
      topLeftPosition.row, 
      Math.max(...interestCols.map(key => columns.colLabelToNumMap[key])),
      Math.max(helper.getLastRow(), topLeftPosition.row)
    ).getValues());

    projectionsSheetMemoization = {
      data: transformData(data),
      interestRates,
      interestRateMap: interestRates.reduce((acc, { account, rate }) => ({
        ...acc,
        [account]: rate
      }), {}),
      columns: dataCols.reduce((acc, col) => {
        return { ...acc, [col]: col }
      }, {})
    }
  }
  
  const funcs = {
    getData: () => {
      memoizeAll();
      return projectionsSheetMemoization.data;
    },

    getInterestRates: () => {
      memoizeAll();
      return projectionsSheetMemoization.interestRates;
    },

    getInterestRatesFor: (account) => {
      memoizeAll();
      return projectionsSheetMemoization.interestRateMap[account] || 0;
    },

    getColumns: () => {
      memoizeAll();
      return projectionsSheetMemoization.columns;
    }
  }
  
  return funcs;
})();



