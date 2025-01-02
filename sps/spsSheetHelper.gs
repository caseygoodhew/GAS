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
    realtimeCheckSum: 'realtimeCheckSum'
  });
 
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
