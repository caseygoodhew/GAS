const testStub_spsValidator_purchaseEventIsOffset = () => { spsValidator_dimOffsetPurchaseEvents(); };

const spsValidator_dimOffsetPurchaseEvents = () => {
  
  const config = {
    name: 'Purchase Events that are matched to Sell Events are dimmed',
    level: RULE_LEVEL.DIM,
    type: RULE_TYPE.ROW
  };
  
  return configValidationRule(
    config,
    // ([Action] is BUY or AWARD) AND ([Offset By] is Set)
    ({ dataRange, columns, colOffsets, rowIndex, helper }) => {
      const targetRow = helper.getRowFromRange(dataRange, rowIndex);
      const actionCell = targetRow.getCell(1, colOffsets[columns.ACTION]);
      if (!helper.isPurchaseTransaction(actionCell.getValue())) {
        return;
      }

      const offsetCell = targetRow.getCell(1, colOffsets[columns.OFFSET_BY]);
      return !helper.isEmpty(offsetCell);
    }
  );
};