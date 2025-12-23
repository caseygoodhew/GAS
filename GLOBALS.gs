const testGlobalSheet = () => {
  const accounts = getGlobalsSheet().getAccounts();
  const aaa = 0;
}

let memoizedGlobalsSheet;

const getGlobalsSheet = () => {
  
  if (memoizedGlobalsSheet != null) {
    return memoizedGlobalsSheet;
  }
  
  const GLOBALS_SHEET_NAME = 'GLOBALS';

  const helper = makeHelper(GLOBALS_SHEET_NAME);
  const [refs] = initMagicCoordinates(helper.getRange(1, 1, 50, 3), {
    earliestDate: 'earliestDate',
    latestDate: 'latestDate',
    todayRef: 'todayRef',
    accountsFirst: 'accountsFirst',
    accountsLast: 'accountsLast'
  });

  const earliest = helper.getRange(refs.earliestDate.col, refs.earliestDate.row).getValue();
  const latest = helper.getRange(refs.latestDate.col, refs.latestDate.row).getValue();
  let todayRef = helper.getRange(refs.todayRef.col, refs.todayRef.row).getValue();

  const accounts = helper.getRange(
    refs.accountsFirst.col, 
    refs.accountsFirst.row, 
    refs.accountsLast.col + 1, 
    refs.accountsLast.row
  ).getValues().reduce((acc, row) => {
    const key = row[0].trim();
    if (key) {
      acc[key] = row[1] 
    }
    return acc;
  }, {});

  if (!isDate(earliest)) {
    throw new Error(`Expected "earliest" to be a date, got ${earliest}`);
  }

  if (!isDate(latest)) {
    throw new Error(`Expected "latest" to be a date, got ${latest}`);
  }

  if (!isDate(todayRef)) {
    throw new Error(`Expected "todayRef" to be a date, got ${todayRef}`);
  }

  const funcs = {
    getSheetName: () => {
      return GLOBALS_SHEET_NAME;
    },

    getEarliest: () => {
      return new Date(earliest);
    },

    getLatest: () => {
      return new Date(latest);
    },

    getTodayRef: () => {
      return new Date(todayRef);
    },

    refreshTodayRef: () => {
      const date = new Date();
      helper.getRange(refs.todayRef.col, refs.todayRef.row).setValue(date);
      todayRef = date;
    },

    getAccounts: () => {
      return {...accounts};
    }
  }

  memoizedGlobalsSheet = funcs;
  
  return funcs;
}
