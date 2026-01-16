const isRange = (range) => {
  // there's a Range class, but I don't think we can use instanceof with it, so we need to be a little hacky
  return typeof range === 'object' 
    && typeof range.getColumn === 'function'
    && typeof range.getRow === 'function'
    && typeof range.getLastColumn === 'function'
    && typeof range.getLastRow === 'function'
    && typeof range.getCell === 'function';
}

const a1ToArray = (a1) => {
  if (!isString(a1)) {
    throw new Error(`Expected a1 to be a string, got (${a1})`)
  }
  
  const split = a1.split(':');
  if (split.length > 1) {
    if (split.length !== 2) {
      throw new Error(`Expected that if a1 had a colon (:), only one colon would be present. Got ${split.length}`);
    }

    return [...a1ToArray(split[0]), ...a1ToArray(split[1])];
  }

  const re = /([a-z]+)([0-9]+)/i;

  if (!re.test(a1)) {
    throw new Error(`a1 does not appear to be a valid annotation (${a1})`);
  }

  const matches = a1.match(re);
  return [toColNumber(matches[1]), parseInt(matches[2], 10)];
}

const rangeArrayIncludes = (array, col, row) => {
  if (!isArray(array)) {
    throw new Error(`Expected array to be an ... arrray`);
  }

  if (!isNumber(array[0]) || !isNumber(array[1])) {
    throw new Error(`Expected array to only contain numbers`)
  }
  
  if (array.length > 2 && (!isNumber(array[2]) || !isNumber(array[3]))) {
    throw new Error(`Expected array to only contain numbers`)
  }

  if (!(isNumber(col) || isString(col))) {
    throw new Error(`Expected col to be a col letter or col number, got (${col})`);
  }

  if (!isNumber(row)) {
    throw new Error(`Expected row to be a number, got (${row})`);
  }

  const colNum = toColNumber(col);

  switch (array.length) {
    case 2:
      return array[0] === colNum && array[1] === row;

    case 4: 
      return array[0] <= colNum && array[1] <= row && array[2] >= colNum && array[3] >= row;

    default:
      throw new Error(`Expected array to have either 2 or 4 elements, actually has ${array.length} elements. (${array.join(", ")}) `)
  }
  
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

const toColNumber = (colLetter) => {
  if (isNumber(colLetter)) {
    return colLetter
  }

  if (!isString(colLetter)) {
    throw new Error(`Expected colLetter to be a string, got (${colLetter})`);
  }

  if (!/[A-Z]+/i.test(colLetter)) {
    throw new Error(`Expected colLetter to be a column letter only, got (${colLetter})`);
  }
  
  const column = colLetter.toUpperCase(); 
  let number = 0;

  for (let i = 0; i < column.length; i++) {
    const charCode = column.charCodeAt(i) - 64; 
    number = number * 26 + charCode;
  }

  return number;
};

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

  let suffix = '';
  // CGT is split in the 24/25 tax year with an increase after Oct 29
  if (year === 24) {
    suffix = value < new Date(2024, 9, 30) ? '-1' : '-2';
  }

  return `${year}/${year+1}${suffix}`;
}

const symbolRatesMap = {};
// provides memoization
const readAllRatesForSymbol = (symbol) => {
  throw new Error('DEPRECATED. MIGRATE TO stockPriceReader')
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
  throw new Error('DEPRECATED. MIGRATE TO stockPriceReader')
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

const addDays = (valueOrCell, days) => {
  
  const date = asValue(valueOrCell);
  if (!isDate(date)) {
    throw new Error(`Cannot add a day as (${valueOrCell}) is not a date.`)
  }

  return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000))
}

const addMonths = (valueOrCell, months) => {
  
  const date = asValue(valueOrCell);
  if (!isDate(date)) {
    throw new Error(`Cannot add a month as (${valueOrCell}) is not a date.`)
  }
  
  const newDate = new Date(date.getTime());
  
  const currentMonth = newDate.getMonth();
  
  newDate.setMonth(currentMonth + months);
  
  return newDate;
};

const getDaysBetweenDates = (date1, date2) => {
  // Define the number of milliseconds in one day
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // 1. Calculate the difference in milliseconds
  // We use Math.abs() to ensure a positive result regardless of date order
  const diffInMs = Math.abs(date2.getTime() - date1.getTime());

  // 2. Convert the difference from milliseconds to days
  const diffInDays = diffInMs / MS_PER_DAY;

  // 3. Round down to the nearest whole number to get the number of full days passed
  return Math.floor(diffInDays);
}

const setTime = (valueOrCell, hour = 0, minute = 0, second = 0) => {
  const date = asValue(valueOrCell);
  if (!isDate(date)) {
    throw new Error(`Cannot set time as (${valueOrCell}) is not a date.`)
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, second, 0);
}

const initFastFind = (data, sortDir) => {
  if (!['ASC', 'DESC'].includes(sortDir)) {
    throw new Error(`sortDir must be either ASC or DESC (got ${sortDir})`);
  }

  if (!isArray(data)) {
    throw new Error(`Expected data to be an array`);
  }

  data.forEach((item, index) => {
    if (!isDate(item.date)) {
      throw new Error(`Expected each item in the dataset to contain a property named "date" that always contains a valid date (Err at index ${index})`);
    }
  })

  const exec = (date, toleranceDays) => {
    if (data.length === 0) {
      return null;
    }

    // this assumes that the history is sorted most recent (index 0) to oldest (end)
    let smallest = 0
    let largest = data.length - 1;
    
    while (largest - smallest > 10) {
      let mid = Math.floor((largest - smallest) / 2) + smallest;
      
      if (sortDir === 'DESC' && data[mid].date < date) {
        largest = Math.min(data.length - 1, mid + 1);
      } else if (sortDir === 'ASC' && data[mid].date > date) {
        largest = Math.min(data.length - 1, mid + 1);
      } else {
        smallest = Math.max(0, mid - 1);
      }
    }
    
    let closest = null
    for (let i = smallest; i <= largest; i++) {
      if (data[i].date > date) {
        continue;
      }

      if (closest == null || data[i].date > closest.date) {
        closest = data[i];
      }
    }

    if (toleranceDays != null && closest.date < addDays(date, -toleranceDays)) {
      return null;
    }

    return closest;
  }

  return exec;
}

const pivotArray = (array) => {
  if (!isArray(array)) {
    throw new Error(`Expected an array, got your trash`);
  }

  if (!isArray(array[0])) {
    //throw new Error(JSON.stringify(array, undefined, 2))
    throw new Error(`Expected an array of arrays, got a monstrosity`);
  }

  // 1. Get the number of columns (length of the first row)
  const numColumns = array[0].length;

  // 2. Use Array.from() to iterate over the column indices (0, 1, 2...)
  return Array.from({ length: numColumns }, (_, colIndex) => {
      // 3. For each column index, use map() to create a new row
      //    by pulling the element at that column index from every original row.
      return array.map(row => row[colIndex]);
  });
}

const lightenHexColor = (hex, percent) => {
    if (!isString(hex)) {
      throw new Error(`Expected hex to be a valid hexidecimal color code, got (${hex})`)
    }

    if (!isNumber(percent)) {
      throw new Error(`Expected percent to be a number, got (${percent})`)
    }
    
    // 1. Validate and clean up the hex string
    let str = hex.replace('#', '');
    if (str.length === 3) { // Expand 3-digit shorthand (e.g., #ABC -> #AABBCC)
        str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];
    }
    
    // Ensure it's a valid 6-character hex string (ignore alpha channel if present)
    const hexRegex = /^[0-9A-F]{6}$/i;
    if (!hexRegex.test(str)) {
        throw new Error('Invalid hex color format: ' + str);
    }
    
    // The amount to change each channel, converted to a factor (e.g., 20% -> 0.2)
    const factor = percent < 1 ? percent : percent / 100;
    
    let R = parseInt(str.substring(0, 2), 16);
    let G = parseInt(str.substring(2, 4), 16);
    let B = parseInt(str.substring(4, 6), 16);
    
    // 2. Lighten and clamp each RGB component
    
    // To 'lighten' by factor 'p', we move R, G, B closer to 255 (white).
    // New R = R + (255 - R) * factor
    // This formula ensures that if R is already 255, the new R is also 255 (it clamps itself).
    R = Math.min(255, Math.round(R + (255 - R) * factor));
    G = Math.min(255, Math.round(G + (255 - G) * factor));
    B = Math.min(255, Math.round(B + (255 - B) * factor));

    // 3. Convert back to hex and format
    
    // Helper function to convert a decimal number to a 2-digit hex string
    const toHex = (c) => {
        const h = c.toString(16);
        return h.length === 1 ? '0' + h : h;
    };

    return '#' + toHex(R) + toHex(G) + toHex(B);
}

const colorArray = (startHex, dimBy, size) => {
  const colors = [startHex];
  for (let i = 1; i < size; i++) {
    colors.push(lightenHexColor(startHex, dimBy * i));
  }
  return colors;
}

const clone = (value) => {
  const str = JSON.stringify({ value });
  return JSON.parse(str).value;
}

const sumOf = (numbers) => {
  return numbers.reduce((sum, num) => sum + num, 0);
}

