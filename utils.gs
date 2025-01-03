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