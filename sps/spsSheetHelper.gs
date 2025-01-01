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
  const [dataRangeCoordinates, reporting] = initMagicCoordinates(
    sheet, 
    columns.colLabelToNumMap[columns.FORMAT_CODE], 
      {
        dataStart: 'start',
        dataEnd: 'end'
      }, {
      reportLastRun: 'lastRun', 
      reportDuration: 'duration', 
      reportDataRange: 'dataRange', 
      reportStatus: 'status' ,
      checkSum: 'checkSum',
      realtimeCheckSum: 'realtimeCheckSum'
    }
  )
 
  const rows = {
    first: dataRangeCoordinates.start.row,
    last: dataRangeCoordinates.end.row
  };

  const helper = makeHelper(sheet, columns.colLabelToNumMap);
  const statusCell = helper.getCell(reporting.status.col, reporting.status.row);
  const checkSumCell = helper.getCell(reporting.checkSum.col, reporting.checkSum.row);

  // SETUP DATA OBJECT
  const data = { 
    columns, 
    rows, 
    reporting,
  };

  const updateRunStats = (() => {
    const lastRunCell = sheet.getRange(reporting.lastRun.row, reporting.lastRun.col);
    const durationCell = sheet.getRange(reporting.duration.row, reporting.duration.col);
    const dataRangeCell = sheet.getRange(reporting.dataRange.row, reporting.dataRange.col);

    return ({ lastRun, duration, dataRange }) => {
      lastRunCell.setValue(lastRun ?? '');
      durationCell.setValue(duration ?? '');
      dataRangeCell.setValue(dataRange ?? '');
    }
  })();

  updateRunStats({});
  
  // DEFINE HELPER FUNCTIONS SPECIFIC TO THIS SHEET
  const fns = {
    isSellTransaction: (action) => {
      return action === 'SELL';
    },

    isPurchaseTransaction: (action) => {
      return action !== 'SELL';
    },

    updateRunStatus: (() => {
      
      const dimmed = SpreadsheetApp.newTextStyle()
                    .setUnderline(false)
                    .setBold(false)
                    .setItalic(true)
                    .setForegroundColor('#999999')
                    .build();

      const intro = 'Running validation script'
      
      return (status) => {
        console.log(status);
      
        const value = SpreadsheetApp.newRichTextValue()
                          .setText(`${intro}\n\n${status}`)
                          .setTextStyle(0, intro.length, dimmed)
                          .build();

        statusCell.setRichTextValue(value);
      }
    })(),

    updateFinalStatus: (finalStatus) => {
      const completedAt = new Date();
      
      const dataRange = helper.getRange(dataRangeCoordinates.start.col, dataRangeCoordinates.start.row, dataRangeCoordinates.end.col, dataRangeCoordinates.end.row);
      
      checkSumCell.setValue(CHECKSUM(dataRange.getValues()));
      
      const a1_left = helper.toA1Notation(reporting.checkSum.col, reporting.checkSum.row);
      const a1_right = helper.toA1Notation(reporting.realtimeCheckSum.col, reporting.realtimeCheckSum.row);

      statusCell.setFormula(`=if(${a1_left}=${a1_right}, "${finalStatus ?? 'OK!'}", "Data has changed since you last ran Validate")`)

      updateRunStats({
        lastRun: completedAt,
        duration: `${Math.round((completedAt - startedAt)/100)/10}s`,
        dataRange: `${helper.toA1Notation(dataRangeCoordinates.start.col, dataRangeCoordinates.start.row)}:${helper.toA1Notation(dataRangeCoordinates.end.col, dataRangeCoordinates.end.row)}`
      })
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

/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////



const initMagicCoordinates = (sheet, colNum, ...keySets) => {
  const magicCoordinates = {};
  const formatColValues = sheet.getRange(
    1, 
    colNum, 
    sheet.getDataRange().getNumRows(), 
    1
  ).getValues().flat();

  // e.g. {lastRun[13,4]}
  const re = /{([a-z]+)\[([0-9]+)(,([0-9]+))*\]}/i;

  formatColValues.forEach((value) => {
    const match = value.match(re);
    if (match) {
      magicCoordinates[match[1]] = {
        row: parseInt(match[2], 10),
        col: match[4] == null ? match[4] : parseInt(match[4], 10),
      }
    }
  });

  const validateMagicCoordinateHasRowAndCol = (key) => {
    if (!magicCoordinates[key]) {
      throw new Error(`Expected to find magic coordinate with label "${key}"`);
    }

    if (magicCoordinates[key].row == null) {
      throw new Error(`Expected to find magic coordinate with label "${key}" and row value defined`);
    }

    if (magicCoordinates[key].col == null) {
      throw new Error(`Expected to find magic coordinate with label "${key}" and col value defined`);
    }
  }

  const getKeys = inKey => {
    if (typeof inKey === 'string') {
      return [[inKey, inKey]];
    }

    if (typeof inKey !== 'object') {
      throw new Error(`Expected key to be either a string or an object, got '${typeof inKey}'`);
    }

    return Object.keys(inKey).map(key => [key, inKey[key]]);
  }

  return keySets.map(keySet => (Array.isArray(keySet) ? keySet : [keySet]).reduce((obj, inKey) => {
      const allKeys = getKeys(inKey);
      allKeys.forEach(keys => {
        const [mcKey, outKey] = keys;
        validateMagicCoordinateHasRowAndCol(mcKey);
        obj[outKey] = magicCoordinates[mcKey];
      })
      return obj;
  }, {}));

  // DEFINE THE DATA RANGE THAT WE'RE WORKING WITH
//  ['dataStart', 'dataEnd'].forEach(validateMagicCoordinateHasRowAndCol);
  
//  const rows = {
//    first: magicCoordinates.dataStart.row,
//    last: magicCoordinates.dataEnd.row
//  };

//  const dataRangeCoordinates = {
//    start: magicCoordinates.dataStart,
//    end: magicCoordinates.dataEnd
//  };

  // DEFINE THE REPORT CELLS WE'RE WORKING WITH
//  [
//    'reportLastRun', 
//    'reportDuration', 
//    'reportDataRange', 
//    'reportStatus', 
//    'checkSum',
//    'realtimeCheckSum'
//  ].forEach(validateMagicCoordinateHasRowAndCol);
  
//  const reporting = {
//    lastRun: magicCoordinates.reportLastRun,
//    duration: magicCoordinates.reportDuration,
//    dataRange: magicCoordinates.reportDataRange,
//    status: magicCoordinates.reportStatus,
//    checkSum: magicCoordinates.checkSum,
//    realtimeCheckSum: magicCoordinates.realtimeCheckSum
//  };
}

// Requires that the first 2 rows of a sheet represent the labelled columns
// [1] | COL_NAMES | IN_CAMEL_UPPER |
// [2] | Col Names | In Friendly Case |
const initLabelledColumns = (sheet, expectedLabels) => {

  const sheetName = sheet.getSheetName();

  const columns = expectedLabels.reduce((o, v) => {
    o[v] = v;
    return o;
  }, {});

  const rowValues = sheet.getRange(1, 1, 2, sheet.getDataRange().getNumColumns()).getValues();
  // internal
  const labelRowValues = rowValues[0];
  const headingRowValues = rowValues[1];
  

  // returned
  const colLabelToNumMap = {};
  const colNumToLabelMap = {};
  const colHeadingsMap = {};

  labelRowValues.forEach((key, index) => {
    if (columns[key]) {
      colLabelToNumMap[key] = index + 1;
      colNumToLabelMap[index + 1] = key;
      colHeadingsMap[key] = headingRowValues[index];
    }
  });

  const missingColumns = Object.keys(columns).filter(key => !colLabelToNumMap[key]);

  if (missingColumns.length !== 0) {
    throw new Error(`Missing labeled columns ['${missingColumns.join(', ')}'] in sheet '${sheetName}'`)
  }

  const columnIndicies = Object.values(colLabelToNumMap);

  return {
    ...columns,
    colNumToLabelMap,
    colLabelToNumMap,
    keys: Object.keys(columns),
    first: Math.min(...columnIndicies),
    last: Math.max(...columnIndicies),
    headingMap: colHeadingsMap
  };
}
