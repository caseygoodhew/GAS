function CHECKSUM(values) {
  // we stringify because values from the formula bar are slightly different to values from range.getValues() 
  // and end up generating a different hash
  const input = JSON.stringify(values);
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  var txtHash = '';
  for (i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
};

function SHEETNAME() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}

function REFRESH_A1_SEED() {
  const range = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange(1, 1);

  range.setValue(RAND_STRING(6));
}

function RAND_STRING(length) {
  const arr = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  for (let i = 0; i < length; i++) { 
    arr.push(chars.charAt(Math.floor(Math.random()*chars.length)));
  }
  
  return arr.join('');
}

function FORCE_EXCHANGE_NOW_DATE_REFRESH() {
  
  const globalsSheet = getGlobalsSheet();

  const now = new Date();
  const curDate = globalsSheet.getTodayRef();

  if (!isDate(curDate) || addDays(curDate, 1) < now) {
    globalsSheet.refreshTodayRef();
  }
}

function RFIND(search_for, text_to_search, starting_at) {
  search_for = (search_for == null) ? '' : '' + search_for;
  text_to_search = (text_to_search == null) ? '' : '' + text_to_search; 
  
  const index = text_to_search.lastIndexOf(search_for, starting_at);

  if (index === -1) {
    throw new Error('Text not found')
  }

  return index + 1;
}

function RANGEOF(startAddress, endAddress) {
  const cellMatchRe = /^([\$]{0,1}[A-Z]+)([\$]{0,1}[0-9]+)$/;
  const sheetMatchRe = /^(?:[0-9A-Za-z '_\-\&]+!)?([\$]{0,1}[A-Z]+)([\$]{0,1}[0-9]+)$/;
  
  const splitAddress = (address) => {
    const parts = address.split('!');
    const cell = parts.pop();
    const sheet = parts.pop() ?? '';
    const matches = cellMatchRe.exec(cell);
    return { sheet, col: matches[1], row: matches[2] };
  }
  
  const startCell = splitAddress(startAddress);
  
  if (endAddress === 'COLUMN') {
    endCell = { sheet: startCell.sheet, col: startCell.col, row: '' }
  } else if (endAddress === 'ROW') {
    endCell = { sheet: startCell.sheet, col: '', row: startCell.row }
  } else if (sheetMatchRe.test(endAddress)) {
    endCell = splitAddress(endAddress);
  } else {
    throw new Error(`endAddress (${endAddress}) should be COLUMN, ROW or a valid cell address (although regex does have a limited character set)`)
  }

  if (startCell.sheet !== endCell.sheet) {
    throw new Error(`startAddress sheet (${startCell.sheet}) and endAdress sheet (${endCell.sheet}) must be the same`) 
  }

  const sheetSep = startCell.sheet.length ? '!' : '';
  return `${startCell.sheet}${sheetSep}${startCell.col}${startCell.row}:${endCell.col}${endCell.row}`;
}

function JOINRANGE(range, joinWith, ignoreEmpty) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var values = sheet.getRange(range).getValues()
  
  const toJoin = values.flat().filter(value => !(ignoreEmpty && isEmpty(value)));

  return toJoin.join(joinWith ?? '');
}

function REFRESH_INVESTMENT_OVERVIEW_DATES() {
  const globalsSheet = getGlobalsSheet();
  // This is expected to be the Investment Overview sheet, but we don't need to be concrete on the name by using Active Sheet
  
  const earliest = globalsSheet.getEarliest();
  const latest = globalsSheet.getLatest();

  const helper = makeHelper(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet());
  helper.getRange('F', 6).setValue(earliest);
  helper.getRange('F', 7).setValue(latest);
}