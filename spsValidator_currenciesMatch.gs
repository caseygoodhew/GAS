const testStub_spsValidator_currencyMatch = () => {
  spsValidator_currencyMatch({ columns: { OFFSET_CURRENCY: 'OFFSET_CURRENCY' }});
};

const spsValidator_currencyMatch = ({ columns }) => {
  const config = {
    name: 'Offset Currency matches Event Currency',
    //message: '',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.OFFSET_CURRENCY,
  };
  
  return configValidationRule(
    config,
    ({ targetCell: offsetCurrencyCell, rowRange, columns, colOffsets, helper}) => {
      
      const offsetCurrencyValue = offsetCurrencyCell.getValue();

      if (helper.isEmpty(offsetCurrencyValue)) {
        const offsetByCell = rowRange.getCell(1, colOffsets[columns.OFFSET_BY]);
        if (!helper.isEmpty(offsetByCell)) {
          return `Expected ${columns.headingMap[columns.OFFSET_CURRENCY]} to contain a value as ${columns.headingMap[columns.OFFSET_BY]} is set`;
        }
        
        return;
      }

      const currencyCell = rowRange.getCell(1, colOffsets[columns.CURRENCY]);
      const currencyValue = currencyCell.getValue();

      if (currencyValue !== offsetCurrencyValue) {
        return `Expected ${columns.headingMap[columns.OFFSET_CURRENCY]} (${offsetCurrencyValue}) to match ${columns.headingMap[columns.CURRENCY]} (${currencyValue})`;
      }
    },
  );
};