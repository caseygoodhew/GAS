const testStub_spsValidator_purchaseTransactionIsValid = () => {
  spsValidator_purchaseTransactionIsValid({ columns: { OFFSET_BY: 'OFFSET_BY' }});
};

const spsValidator_purchaseTransactionIsValid = ({ columns }) => {
  const config = {
    name: 'Purchase Transactions are setup correctly',
    //message: '',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.OFFSET_BY,
  };
  
  /**
   * We're validating that the PURCHASE transaction is roughly setup correctly
   * - it must have a compensating transaction (OFFSET_BY) if this EVENT_ID is in use
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

      if (!helper.isPurchaseTransaction(actionCell.getValue())) {
        return;
      }

      const idCell = rowRange.getCell(1, colOffsets[columns.EVENT_ID]);
      const myId = idCell.getValue();
      const myOffsetId = offsetByCell.getValue();

      const offsetColRange = helper.getColFromRange(dataRange, colOffsets[columns.OFFSET_BY]);
      const matchingOffsetCount = helper.countOccurrences(offsetColRange, myId);

      if (matchingOffsetCount === 0) {
          if (!helper.isEmpty(myOffsetId)) {
            return `Expected ${columns.headingMap[columns.OFFSET_BY]} to be empty when this ${columns.headingMap[columns.EVENT_ID]} is not referenced in another cell.`;
          }

          return;
      }

      if (matchingOffsetCount > 1) {
        return `Expected only one other row to be referencing this ${columns.headingMap[columns.EVENT_ID]} (${myId}). Found ${matchingOffsetCount} references.`
      }

      if (helper.isEmpty(myOffsetId)) {
        return `Expected ${columns.headingMap[columns.OFFSET_BY]} to be set when this ${columns.headingMap[columns.EVENT_ID]} is referenced by another cell.`
      }
    },
  );
};