const testStub_spsValidator_allEventsArePresent = () => { spsValidator_allEventsArePresent(); };

const spsValidator_allEventsArePresent = ({ columns }) => {
  
  const config = {
    name: 'all Events are present',
    level: RULE_LEVEL.DIM,
    type: RULE_TYPE.COL,
    targetCol: columns.EVENT_ID,
  };

  const getExpectedEventIdsWithSymbols = () => {
    const helper = makeHelper('Charles Schwab Transaction History');
    const sheet = helper.getSheet();
    const range = sheet.getDataRange();
    
    const symbols = helper.getColFromRange(range, 3).getValues().flat();
    const eventIds = helper.getColFromRange(range, 12).getValues().flat();
    const eventIdRe = /[A-Z]{6,6}/
    const firstRow = eventIds.findIndex(eventId => eventIdRe.test(eventId));

    const map = {};
    
    for (let row = firstRow; row < eventIds.length; row++) {
      eventId = eventIds[row];
      symbolValue = symbols[row];
      if (!helper.isEmpty(eventId)) {
        map[eventId] = symbolValue;
      }
    }

    return map;
  }

  const findMisssingEventIds = (actualEventIds, expectedEventIds) => {
    return expectedEventIds.filter(expectedEventId => !actualEventIds.includes(expectedEventId));
  }

  const findUnknownEventIds = (actualEventIds, expectedEventIds) => {
    return actualEventIds.filter(actualEventId => !expectedEventIds.includes(actualEventId));
  } 
  
  return configValidationRule(
    config,
    ({ dataRange, columns, colOffsets, colRange, helper }) => {
      const actualEventIds = colRange.getValues().flat();
      const expectedEventIdsWithSymbolMap = getExpectedEventIdsWithSymbols();
      
      const expectedEventIds = Object.keys(expectedEventIdsWithSymbolMap);

      const missingEventIds = findMisssingEventIds(actualEventIds, expectedEventIds);
      const unknownEventIds = findUnknownEventIds(actualEventIds, expectedEventIds);

      const messages = [];

      if (unknownEventIds.length) {
        messages.push(`There are ${unknownEventIds.length} unknown events:${[''].concat(unknownEventIds).join('\n\n  ')}`)
      }

      if (missingEventIds.length) {
        const symbolCounts = missingEventIds.reduce((map, eventId) => {
          const sym = expectedEventIdsWithSymbolMap[eventId];
          
          map[sym] = map[sym] || 0;
          map[sym]++;
          return map;
        }, {});

        const innerMessages = Object.keys(symbolCounts).sort().map(sym => {
          const count = symbolCounts[sym];
          return count === 1 ? `${sym} is missing 1 event` : `${sym} is missing ${count} events`
        });

        messages.push(`Some events are missing: ${[''].concat(innerMessages).join('\n\n  ')}`);
      }

      return messages.length ? messages.join('\n\n') : null;
    }
  );
};