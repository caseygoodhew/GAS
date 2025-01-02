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

  const STATUSUPDATER = initStatusUpdater(sheet, {
    timestamp: reporting.lastRun,
    duration: reporting.duration,
    dataRange: reporting.dataRange,
    status: reporting.status,
    statusFormula: {
      cell: reporting.status,
      setter: 'setFormula',
    },
    validationRunning: {
      cell: reporting.status,
      setter: 'setRichTextValue',
      formatter: (status) => {
        const dimmed = SpreadsheetApp.newTextStyle()
                    .setUnderline(false)
                    .setBold(false)
                    .setItalic(true)
                    .setForegroundColor('#999999')
                    .build();

        const intro = 'Running validation script';

        return SpreadsheetApp.newRichTextValue()
                            .setText(`${intro}\n\n${status}`)
                            .setTextStyle(0, intro.length, dimmed)
                            .build();
      }
    }, 
  });

  // SETUP DATA OBJECT
  const data = { 
    columns, 
    rows, 
    reporting,
  };

  STATUSUPDATER.clearAll();
  
  // DEFINE HELPER FUNCTIONS SPECIFIC TO THIS SHEET
  const fns = {
    isSellTransaction: (action) => {
      return action === 'SELL';
    },

    isPurchaseTransaction: (action) => {
      return action !== 'SELL';
    },

    updateRunStatus: (status) => {
      STATUSUPDATER.updateOne('validationRunning', status)
    },
      
    updateFinalStatus: (finalStatus) => {
      const completedAt = new Date();
      
      const dataRange = helper.getRange(dataRangeCoordinates.start.col, dataRangeCoordinates.start.row, dataRangeCoordinates.end.col, dataRangeCoordinates.end.row);
      
      checkSumCell.setValue(CHECKSUM(dataRange.getValues()));
      
      const a1_left = helper.toA1Notation(reporting.checkSum.col, reporting.checkSum.row);
      const a1_right = helper.toA1Notation(reporting.realtimeCheckSum.col, reporting.realtimeCheckSum.row);

      statusCell.setFormula(`=if(${a1_left}=${a1_right}, "${finalStatus ?? 'OK!'}", "Data has changed since you last ran Validate")`)

      STATUSUPDATER.update({
        timestamp: completedAt,
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

const initCellUpdater = (() => {
  const cellConfig = (resolvedCell, cellMapItem) => {
    
    let makeSetter;

    if (cellMapItem.setter == null) {
      makeSetter = (cell) => cell.setValue;
    } else if (typeof cellMapItem.setter === 'string') {
      if (typeof resolvedCell[cellMapItem.setter] === 'function') {
        makeSetter = (cell) => cell[cellMapItem.setter];
      } else {
        throw new Error(`Where the setter is a string, it must the name of a function of a cell (range). Got '${cellMapItem.setter}'`);
      }
    } else if (typeof cellMapItem.setter === 'function') { 
      makeSetter = cellMapItem.setter;
    } else {
      throw new Error(`Unexpected typeof setter === '${typeof setter}'`);
    }
    
    return {
      cell: resolvedCell,
      formatter: cellMapItem.formatter ?? (v => v),
      setter: makeSetter(resolvedCell)
    }
  }

  const resolveCells = (sheet, cellMap) => {
    
    return Object.keys(cellMap).reduce((object, key) => {
      const fn = () => {
        const cell = cellMap[key].cell || cellMap[key];
        
        if (cell == null) {
          throw new Error(`Cell with key ${key} is nullish and cannot be resolved`)
        }

        // an actual cell
        if (isRange(cell)) {
          return cellConfig(cell, cellMap[key]);
        }

        // row / column num
        if (typeof cell.row === 'number' && typeof cell.col === 'number') {
          return cellConfig(sheet.getRange(cell.row, cell.col), cellMap[key]);
        }

        // assume that it's a range that can be understood by sheet
        try {
          return cellConfig(sheet.getRange(cell), cellMap[key]);
        } catch (e) {
          throw new Error(`Tried to resolve cell with value '${cell}', but caught exception with message'${e.message}'`);
        }
      }

      object[key] = fn();
      return object;
    }, {});
  }

  return (sheet, cellMap) => { 
    cellMap = resolveCells(sheet, cellMap);

    const fns = {
      clearAll: () => {
        Object.keys(cellMap).forEach(key => fns.clearOne(key));
      },

      clearOne: (key) => {
        fns.updateOne(key, '');
      },
      
      update: (map) => {
        Object.keys(map).forEach(key => {
          fns.updateOne(key, map[key]);
        });
      },

      updateOne: (key, value) => {
        if (!cellMap[key]) {
          throw new Error(`Could not find declared cell with label ${key}`);
        }

        const formatted = cellMap[key].formatter(value);

        const valueToLog = typeof value === 'string' ? value : (typeof formatted === 'string' ? formatted : formatted.toString());

        console.log(`${key}: ${valueToLog}`);

        cellMap[key].setter(formatted);
      }
    }

    return fns;
  }
})();
