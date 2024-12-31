const testStub_spsValidator_eventDoesNotOffsetItself = () => {
  spsValidator_eventDoesNotOffsetItself({ columns: { EVENT_ID: 'EVENT_ID' }});
};

const spsValidator_eventDoesNotOffsetItself = ({ columns }) => {
  const config = {
    name: 'events do not offset themselves',
    messageTarget: MESSAGE_TARGET.COMMENT,
    level: RULE_LEVEL.ERROR,
    type: RULE_TYPE.CELL,
    targetCol: columns.EVENT_ID,
  };
  
  return configValidationRule(
    config,
    ({ targetCell: idCell, dataRange, rowRange, columns, colOffsets, helper}) => {
      
      const offsetByCell = rowRange.getCell(1, colOffsets[columns.OFFSET_BY]);
      const myId = idCell.getValue();
      const myOffsetId = offsetByCell.getValue();

      if (typeof myId !== 'string') {
        return `Expected ${columns.headingMap[columns.EVENT_ID]} to be a string (got '${typeof myId}')`
      }
      
      if (!myId.length) {
        return `Expected ${columns.headingMap[columns.EVENT_ID]} to be set (got empty)`;
      }

      if (myId === myOffsetId) {
        return `Events cannot offset themselves (got '${myId}' for both ${columns.headingMap[columns.EVENT_ID]} and ${columns.headingMap[columns.OFFSET_BY]} )`;
      }
    },
  );
};