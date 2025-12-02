let memoizedGlobalsSheet;

const getGlobalsSheet = () => {
  
  if (memoizedGlobalsSheet != null) {
    return memoizedGlobalsSheet;
  }
  
  const GLOBALS_SHEET_NAME = 'GLOBALS';

  const helper = makeHelper(GLOBALS_SHEET_NAME);
  const [dateRefs] = initMagicCoordinates(helper.getRange(1, 1, 50, 3), {
    earliestDate: 'earliestDate',
    latestDate: 'latestDate',
    todayRef: 'todayRef'
  });

  const earliest = helper.getRange(dateRefs.earliestDate.col, dateRefs.earliestDate.row).getValue();
  const latest = helper.getRange(dateRefs.latestDate.col, dateRefs.latestDate.row).getValue();
  let todayRef = helper.getRange(dateRefs.todayRef.col, dateRefs.todayRef.row).getValue();

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
      helper.getRange(dateRefs.todayRef.col, dateRefs.todayRef.row).setValue(date);
      todayRef = date;
    } 
  }

  return funcs;
}
