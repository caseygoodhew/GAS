const isRange = (range) => {
  // there's a Range class, but I don't think we can use instanceof with it, so we need to be a little hacky
  return typeof range === 'object' 
    && typeof range.getColumn === 'function'
    && typeof range.getRow === 'function'
    && typeof range.getLastColumn === 'function'
    && typeof range.getLastRow === 'function'
    && typeof range.getCell === 'function';
}

const toColLetter = (colNum) => {
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
}

const toA1Notation = (colNumOrLetter, rowNum) => {
  const colLetter = typeof colNumOrLetter === 'string' ? colNumOrLetter : toColLetter(colNumOrLetter);
  return `${colLetter}${rowNum}`;
}

const asValue = (valueOrCell) => {
  const isCell = typeof valueOrCell === 'object' && typeof valueOrCell.getValue === 'function'; 
  return isCell ? valueOrCell.getValue() : valueOrCell;
}

const isNumber = (valueOrCell) => {
  const value = asValue(valueOrCell);
  return typeof value === 'number';
}

const isArray = (o) => {
  return Array.isArray(o);
}

const isObject = (o) => {
  return Object.prototype.toString.call(o) === '[object Object]';
}

const isString = (valueOrCell) => {
  const value = asValue(valueOrCell);
  return typeof value === 'string';
}

const isEmpty = (valueOrCell) => {
  const value = asValue(valueOrCell);

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
}

const isDate = (valueOrCell) => {
  const value = asValue(valueOrCell);
  return value instanceof Date && !isNaN(value.valueOf())
}

const makeEventId = (() => { 
  
  let memoizedEventIds = [];
  let lastRowChecked = 1;
  
  return () => {
  
    while (memoizedEventIds.length === 0) {
      const rowCount = 100;
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('EVENT IDS');
      
      const errorCheckRange = sheet.getRange(1, 8);
      if (errorCheckRange.getValue() !== 'A-OK!') {
        throw new Error('There is an error on the EVENT IDS sheet that must be corrected before generating Event Ids');
      }
      
      const range = sheet.getRange(lastRowChecked + 1, 1, rowCount, 3);
      const available = range.getValues().filter(row => {
        
        if (row[2] === '') {
          throw new Error(`EVENT IDS sheet needs more values added`)
        }

        return row[2] === 0;
      }).map(row => row[0])

      lastRowChecked += rowCount;
      memoizedEventIds.push(...available);
    }
    
    return memoizedEventIds.shift();
  }
})();

const toTaxYear = (valueOrCell) => {
  const value = asValue(valueOrCell);
  if (!isDate(value)) {
    throw new Error(`Cannot calculate tax year of value as value (${value}) is not a date.`)
  } 

  year = value.getFullYear() - 2000;
  month = value.getMonth() + 1;
  day = value.getDate();

  if (month < 4) {
    year--;
  } else if (month === 4 && day < 6) {
    year--;
  }

  return `${year}/${year+1}`;
}

const symbolRatesMap = {};
// provides memoization
const readAllRatesForSymbol = (symbol) => {
  
  if (symbolRatesMap[symbol]) {
    return symbolRatesMap[symbol];
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(symbol);
  if (sheet == null) {
    throw new Error(`Cannot find rate sheet for symbol ${symbol}`)
  }

  const helper = makeHelper(sheet);
  const values = helper.getRange(1, 1, 2, sheet.getLastRow()).getValues();

  values.filter(row => isDate(row[0])).map(row => {
    const date = row[0];
    return [
      date.setHours(0, 0, 0, 0),
      row[1]
    ]
  })
  
  symbolRatesMap[symbol] = values;
  return values;
}

// Must be a symbol that is tracked in its own sheet
// -- assumes dates are in col A, values in col B
// -- assumes that dates are oldest-first-newest-last
// -- assumes data is fully loaded
const readRate = (symbol, date) => {
  
  const values = readAllRatesForSymbol(symbol);

  let index = -1;
  date = date.setHours(0, 0, 0, 0);
  
  for (let r = 0; r < values.length; r++) {
    if (values[r][0] <= date) {
      index = r;
    }
  }

  if (index === -1) {
    return;
  }

  return values[index][1];
}

const equalsPlusOrMinus = (num1, num2, within) => {
  const result =  Math.abs(num1 - num2) < Math.abs(within);
  return result;
}

const numberWithCommas = (valueOrCell) => {
  const value = asValue(valueOrCell);
  if (!isNumber(value)) {
    return value;
  }

  const parts = value.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}



