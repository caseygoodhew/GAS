const testStub_spsValidator_symbolsMatch = () => {
  spsValidator_symbolsMatch({ columns: { OFFSET_SYMBOL: 'OFFSET_SYMBOL' }});
};

const spsValidator_symbolsMatch = ({ columns }) => {
  const config = {
    name: 'Offset Symbol matches Event Symbol',
    //message: '',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.OFFSET_SYMBOL,
  };
  
  return configValidationRule(
    config,
    ({ targetCell: offsetSymbolCell, rowRange, columns, colOffsets, helper}) => {
      
      const offsetSymbolValue = offsetSymbolCell.getValue();

      if (helper.isEmpty(offsetSymbolValue)) {
        const offsetByCell = rowRange.getCell(1, colOffsets[columns.OFFSET_BY]);
        if (!helper.isEmpty(offsetByCell)) {
          return `Expected ${columns.headingMap[columns.OFFSET_SYMBOL]} to contain a value as ${columns.headingMap[columns.OFFSET_BY]} is set`;
        }
        
        return;
      }

      const symbolCell = rowRange.getCell(1, colOffsets[columns.SYMBOL]);
      const symbolValue = symbolCell.getValue();

      if (symbolValue !== offsetSymbolValue) {
        return `Expected ${columns.headingMap[columns.OFFSET_SYMBOL]} (${offsetSymbolValue}) to match ${columns.headingMap[columns.SYMBOL]} (${symbolValue})`;
      }
    },
  );
};