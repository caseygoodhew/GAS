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
   const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Exchanges')
   const range = sheet.getRange(6, 4);

  range.setValue(new Date());
}

function RESET_DATE_TO_REF_EXCHANGE() {
  const range = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange(2, 5);

  range.setFormula("=Exchanges!D1");
}
