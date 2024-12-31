const testStub_spsValidator_dateBelowIsLessThanOrEqual = () => {
  spsValidator_dateBelowIsLessThanOrEqual({ columns: { DATE: 'DATE' }});
};

const spsValidator_dateBelowIsLessThanOrEqual = ({ columns }) => {
  const config = {
    name: 'Dates are listed in decending order',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.DATE,
  };
  
  return configValidationRule(
    config,
    // [Date] Show an error if
    // 	the [Date] < [Date] of the row below
    ({ targetCell: dateCell, columns, rowNum, rows, helper }) => {
      
      if (rowNum >= rows.last) {
        return;
      }
      
      const nextDateCell = helper.getCell(columns.DATE, rowNum + 1);
      
      const curDate = dateCell.getValue();
      const nextDate = nextDateCell.getValue();

      if (curDate < nextDate) {
        return `Expected date (${curDate}) to be greater than or equal to the row below (${nextDate})`;
      }
    },
  );
};