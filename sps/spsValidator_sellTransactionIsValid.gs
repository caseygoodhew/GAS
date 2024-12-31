const testStub_spsValidator_sellTransactionIsValid = () => {
  spsValidator_sellTransactionIsValid({ columns: { OFFSET_BY: 'OFFSET_BY' }});
};

const spsValidator_sellTransactionIsValid = ({ columns }) => {
  const config = {
    name: 'Sell Transactions are setup correctly',
    //message: '',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.OFFSET_BY,
  };
  
  /**
   * We're validating that the SELL transaction is roughly setup correctly
   * - it must have a compensating transaction (OFFSET_BY)
   * - that OFFSET_BY must exist as an EVENT_ID
   * but we don't go deeper than this in this VALIDATION. 
   *
   * Other validations cover self references and a full table scan
   * will do deeper validation that ensures that the critical details 
   * (symbol, units, dates, etc) line up as expected.
   */
  return configValidationRule(
    config,
    ({ targetCell: offsetByCell, dataRange, rowRange, columns, colOffsets, helper}) => {
      const actionCell = rowRange.getCell(1, colOffsets[columns.ACTION]);

      if (!helper.isSellTransaction(actionCell.getValue())) {
        return;
      }

      const value = offsetByCell.getValue();
      if (helper.isEmpty(value)) {
        return `Sell Transactions require that ${columns.headingMap[columns.OFFSET_BY]} must contain the Event ID of a Purchase Transaction`;
      }
      
      if (typeof value !== 'string') {
        return `Expected an Event ID as a 'string', got '${typeof value}'`;
      }

      const colRange = helper.getColFromRange(dataRange, colOffsets[columns.EVENT_ID]);
      const count = helper.countOccurrences(colRange, value);
      
      if (!count) {
        return `Could not find a corresponding Event ID matching '${value}'`;
      }
      
      if (count > 1) {
        return `Found ${count} matching Event IDs. Expected exactly one.`
      }
    },
  );
};