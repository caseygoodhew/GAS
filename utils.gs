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

const makeEventId = () => {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const length = 6;
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }

  return result;
}

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

// Must be a symbol that is tracked in its own sheet
// -- assumes dates are in col A, values in col B
// -- assumes that dates are oldest-first-newest-last
// -- assumes data is fully loaded
const readRate = (symbol, date) => {
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(symbol);
  if (sheet == null) {
    throw new Error(`Cannot find rate sheet for symbol ${symbol}`)
  }

  const helper = makeHelper(sheet);
  const values = helper.getRange(1, 1, 2, sheet.getLastRow()).getValues();

  let index = -1;
  date = date.setHours(0, 0, 0, 0);
  
  for (let r = 0; r < values.length; r++) {
    let d = values[r][0];
    if (isDate(d)) {
      d = d.setHours(0, 0, 0, 0);
      if (d <= date) {
        index = r;
      }
    }
  }

  if (index === -1) {
    return;
  }

  return values[index][1];
}

