const initStockPurchaseAndSales = (sheetName) => {
  sheetName = sheetName ?? 'TEST';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  const startedAt = new Date();

  // DEFINE THE COLUMN & ROW SPACE
  const columns = initLabelledColumns(sheet, [
    'EVENT_ID',
    'DATE',
    'SYMBOL',
    'ACTION',
    'CURRENCY',
    'UNITS',
    'OFFSET_BY',
    'OFFSET_SYMBOL',
    'OFFSET_CURRENCY',
    'OFFSET_UNITS',
    'OFFSET_DATE',
    'BUY_VALUE',
    'SELL_VALUE',
    'VALUE_DELTA',
    'FORMAT_CODE',
  ]);

  // GET MAGIC COORDINATES
  const mcRange = sheet.getRange(
    1, 
    columns.colLabelToNumMap[columns.FORMAT_CODE], 
    sheet.getDataRange().getNumRows(), 
    1
  );

  const [dataRangeCoordinates, reporting] = initMagicCoordinates(mcRange, { 
      dataStart: 'start',
      dataEnd: 'end'
    }, {
    reportLastRun: 'lastRun', 
    reportDuration: 'duration', 
    reportDataRange: 'dataRange', 
    reportStatus: 'status' ,
    checkSum: 'checkSum',
    realtimeCheckSum: 'realtimeCheckSum',
  });
 
  // SETUP THE CELL UPDATER
  const cellUpdater = initCellUpdater(sheet, {
    ...cellUpdater_clearAllOnInit(),
    ...cellUpdater_timestamp(reporting.lastRun),
    ...cellUpdater_duration(reporting.duration),
    ...cellUpdater_validation(reporting.status),
    ...cellUpdater_checksum(reporting.checkSum),
    ...cellUpdater_dataRange(reporting.dataRange),
    ...cellUpdater_finalValidationStatusWithCheckSumComparator(
      reporting.status, 
      reporting.checkSum, 
      reporting.realtimeCheckSum
    )
  });

  // SETUP DATA OBJECT

  const rows = {
    first: dataRangeCoordinates.start.row,
    last: dataRangeCoordinates.end.row
  };

  const data = { 
    columns, 
    rows, 
    reporting,
  };

  // SETUP THE HELPER + EXTENSION FUNCTIONS
  const helper = makeHelper(sheet, columns.colLabelToNumMap);
  
  // DEFINE HELPER FUNCTIONS SPECIFIC TO THIS SHEET
  const fns = {
    isSellTransaction: (action) => {
      return action === 'SELL';
    },

    isPurchaseTransaction: (action) => {
      return action !== 'SELL';
    },

    updateRunStatus: (status) => {
      cellUpdater.event('validating', { message: status })
    },

    getDataRange: () => {
      return helper.getRange(
        dataRangeCoordinates.start.col, 
        dataRangeCoordinates.start.row, 
        dataRangeCoordinates.end.col, 
        dataRangeCoordinates.end.row
      );
    }, 
      
    updateFinalStatus: (status) => {
      const dataRange = fns.getDataRange();
      cellUpdater.event('complete', { dataRange, message: status });
    }
  }

  // RETURN 
  return {
    ...data,
    helper: { 
      ...helper,
      ...fns 
    }
  };
}