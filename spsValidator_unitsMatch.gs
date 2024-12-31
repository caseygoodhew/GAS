const testStub_spsValidator_unitsMatch = () => {
  spsValidator_unitsMatch({ columns: { OFFSET_UNITS: 'OFFSET_UNITS' }});
};

const spsValidator_unitsMatch = ({ columns }) => {
  const config = {
    name: 'Offset Units matches Event Units',
    //message: '',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.OFFSET_UNITS,
  };
  
  return configValidationRule(
    config,
    ({ targetCell: offsetUnitsCell, rowRange, columns, colOffsets, helper}) => {
      
      const offsetUnitsValue = offsetUnitsCell.getValue();

      if (helper.isEmpty(offsetUnitsValue)) {
        const offsetByCell = rowRange.getCell(1, colOffsets[columns.OFFSET_BY]);
        if (!helper.isEmpty(offsetByCell)) {
          return `Expected ${columns.headingMap[columns.OFFSET_UNITS]} to contain a value as ${columns.headingMap[columns.OFFSET_BY]} is set`;
        }
        
        return;
      }

      const unitsCell = rowRange.getCell(1, colOffsets[columns.UNITS]);
      const unitsValue = unitsCell.getValue();

      if (unitsValue !== offsetUnitsValue) {
        return `Expected ${columns.headingMap[columns.OFFSET_UNITS]} (${offsetUnitsValue}) to match ${columns.headingMap[columns.UNITS]} (${unitsValue})`;
      }
    },
  );
};