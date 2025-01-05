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
      
      const nextDateCell = helper.getCell(columns.DATE, rowNum + 1);
      
      const curDate = dateCell.getValue();
      const nextDate = nextDateCell.getValue();

      if (helper.isEmpty(curDate)) {
        return `Expected date to have a value, got empty`
      }

      if (!helper.isDate(curDate)) {
        return `Expected a date, got ${curDate} (typeof '${typeof curDate}')`
      }

      if (helper.isEmpty(nextDate)) {
        return;
      }

      if (!helper.isDate(nextDate)) {
        return `Expected a date (or empty), got ${nextDate} (typeof '${typeof nextDate}')`
      }

      if (curDate < nextDate) {
        return `Expected date (${curDate}) to be greater than or equal to the row below (${nextDate})`;
      }
    },
  );
};