const makeHelper = (sheet, labeledColumnMap) => {

  if (typeof sheet === 'string') {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet);
  }

  labeledColumnMap = labeledColumnMap ?? {};

  const fns = {

    getSheet: () => {
      return sheet;
    },

    isEmpty: (valueOrCell) => {
      const isCell = typeof valueOrCell === 'object' && typeof valueOrCell.getValue === 'function'; 
      
      const value = isCell ? valueOrCell.getValue() : valueOrCell;

      if (value == null) {
        return true;
      } 
      
      if (typeof value === 'string') {
        return value.length === 0;
      }

      if (Number(value) === value) {
        return false;
      }

      if (value instanceof Date && !isNaN(value.valueOf())) {
        return false;
      }

      if (Array.isArray(value)) {
        return false;
      }

      if (typeof value === 'object') {
        return false;
      }

      throw new Error(`Unhandled type check in isEmpty (value is ${value}) (typeof is ${typeof value})`)
    },
    
    resolveToColNum: (col) => {
      if (typeof col === 'number') {
        return col;
      }

      let colIndex = 0;

      if (typeof col === 'string') {
        // Check if this is a labeled column
        if (typeof labeledColumnMap[col] === 'number') {
          colIndex = labeledColumnMap[col];
        }
        
        // maybe its a column letter
        else if (/^([a-z]{1,2})$/i.test(col)) { 
          let ci = 0;

          col.split('').forEach(c => {
            ci *= 26;
            ci += c.toUpperCase().charCodeAt(0) - 64;
          })
        
          colIndex = ci;
        }
      }

      return colIndex <= 0 ? undefined : colIndex;
    },

    resolveToRowNum: (row) => {
      if (typeof row === 'number') {
        return row;
      }

      rowIndex = -1;

      if (typeof row === 'string') {
        var data = sheet.getDataRange().getValues();
        for (var index = 0; index < data.length; index++) {
          if (data[index][0] == row) {
            rowIndex = index;
            break;
          }
        }
      }

      return rowIndex < 0 ? undefined : rowIndex + 1;
    },

    toColLetter: (colNum) => {
      const minColNum = 1;
      const maxColNum = 18278;
      
      // Check for invalid indices
      if (colNum < minColNum || colNum > maxColNum) {
        throw new Error(`Invalid column. Got ${column}, expected within the range of ${minColNum} to ${maxColNum}`)
      }
      
      var columnLetter = "";
      
      // Convert the index into a column letter
      while (colNum > 0) {
        var remainder = (colNum - 1) % 26;
        columnLetter = String.fromCharCode(65 + remainder) + columnLetter;
        colNum = Math.floor((colNum - 1) / 26);
      }
      
      return columnLetter;
    },

    getRange: (col, row, toCol, toRow) => {
      if (col == null) {
        throw new Error('col must be provided');
      }

      if (row == null) {
        throw new Error('row must be provided');
      }
      
      toCol = toCol ?? col;
      toRow = toRow ?? row;

      fromColIndex = fns.resolveToColNum(col);
      fromRowIndex = fns.resolveToRowNum(row);
      toColIndex = toCol == null ? fromColIndex : fns.resolveToColNum(toCol);
      toRowIndex = toRow == null ? fromRowIndex : fns.resolveToRowNum(toRow);

      if (fromColIndex == null) {
        throw new Error(`Could not resolve col '${col}' to a column index`)
      }

      if (fromRowIndex == null) {
        throw new Error(`Could not resolve row '${row}' to a row index`)
      }

      if (toColIndex == null) {
        throw new Error(`Could not resolve toCol '${toCol}' to a column index`)
      }

      if (toRowIndex == null) {
        throw new Error(`Could not resolve toRow '${toRow}' to a row index`)
      }

      // getRange(row, column, numRows, numColumns)
      return sheet.getRange(
        Math.min(fromRowIndex, toRowIndex),
        Math.min(fromColIndex, toColIndex),
        Math.max(fromRowIndex, toRowIndex) - Math.min(fromRowIndex, toRowIndex) + 1,
        Math.max(fromColIndex, toColIndex) - Math.min(fromColIndex, toColIndex) + 1
      )
    },

    getCell: (col, row) => {
      const range = fns.getRange(col, row);
      return range.getCell(1, 1);
    },

    countOccurrences: (range, value) => {
      const allValues = range.getValues().flat()
      const filteredValues = allValues.filter(cellValue => cellValue === value);
      return filteredValues.length;
    },

    toA1Notation: (colNumOrLetter, rowNum) => {
      const colLetter = typeof colNumOrLetter === 'string' ? colNumOrLetter : fns.toColLetter(colNumOrLetter);
      return `${colLetter}${rowNum}`;
    },

    filterToRangeList: (range, value) => {
      const allValues = range.getValues();
      const a1Notations = [];

      for (let rowOffset = 0; rowOffset < allValues.length; rowOffset++) {
        for (let colOffset = 0; colOffset < allValues[rowOffset].length; colOffset++) {
          const cellValue = allValues[rowOffset][colOffset];
          if (cellValue === value) {
            const rowNum = range.getRow() + rowOffset;
            const colNum = range.getColumn() + colOffset;
            a1Notations.push(fns.toA1Notation(colNum, rowNum));
          }
        }
      }
      
      if (!a1Notations.length) {
        return;
      }

      const sheet = range.getSheet();
      return sheet.getRangeList(a1Notations);
    },

    assertIsRange: range => {
      if (!isRange(range)) {
        throw new Error('Value does not appear to be a range')
      }
    },

    forEachCellInRange: (range, fn) => {
      fns.assertIsRange(range);

      if (typeof fn !== 'function') {
        throw new Error('fn does not appear to be a function')
      }

      const numRows = range.getNumRows();
      const numCols = range.getNumColumns();

      for (var row = 1; row <= numRows; row++) {
        for (var col = 1; col <= numCols; col++) {
          fn(range.getCell(row, col), col, row);
        }
      }
    },

    forEachRowInRange: (range, fn) => {
      fns.assertIsRange(range);

      if (typeof fn !== 'function') {
        throw new Error('fn does not appear to be a function')
      }

      const numRows = range.getNumRows();
      for (var row = 1; row <= numRows; row++) {
        fn(fns.getRowFromRange(range, row), row);
      }
    },

    getRowFromRange: (range, rowIndex) => {
      fns.assertIsRange(range);

      if (rowIndex < 1) {
        return;
      }
      
      if (rowIndex > range.getNumRows()) {
        return;
      }

      const sheet = range.getSheet();
      const firstRow = range.getRow();
      const firstCol = range.getColumn();
      const numCols = range.getNumColumns();

      // getRange(row, column, numRows, numColumns)
      return sheet.getRange(
        firstRow + rowIndex - 1, 
        firstCol,
        1,
        numCols
      );
    },

    getColFromRange: (range, colIndex) => {
      fns.assertIsRange(range);

      if (colIndex < 1) {
        return;
      }
      
      if (colIndex > range.getNumColumns()) {
        return;
      }

      const sheet = range.getSheet();
      const firstRow = range.getRow();
      const firstCol = range.getColumn();
      const numRows = range.getNumRows();

      // getRange(row, column, numRows, numColumns)
      return sheet.getRange(
        firstRow, 
        firstCol + colIndex - 1,
        numRows,
        1
      );
    }
  };

  return fns;
}
