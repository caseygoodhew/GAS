const testStub_spsValidator_eachEventIdIsUnique = () => { 
  spsValidator_eachEventIdIsUnique({ columns: { EVENT_ID: 'EVENT_ID' }}); 
};

const spsValidator_eachEventIdIsUnique = ({ columns }) => {
  
  const config = {
    name: 'Each Event ID is listed only once',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.EVENT_ID,
  };
  
  return configValidationRule(
    config,
    // ([Action] is BUY or AWARD) AND ([Offset By] is Set)
    ({targetCell, dataRange, columns, colOffsets, helper}) => {
      const colRange = helper.getColFromRange(dataRange, colOffsets[columns.EVENT_ID]);
      const eventId = targetCell.getValue();
      const count = helper.countOccurrences(colRange, eventId);
      if (count !== 1) {
        return `Event id "${eventId}" was found ${count} times (including in the this cell)`
      }
    }
  );
};