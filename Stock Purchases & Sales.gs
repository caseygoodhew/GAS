

function ValidateStockPurchasesAndSales() {

  const data = initStockPurchaseAndSales();
  const { columns, rows, helper } = data;

  const rules = [
    spsValidator_dateBelowIsLessThanOrEqual(data),
    spsValidator_eachEventIdIsUnique(data),
    spsValidator_eventDoesNotOffsetItself(data),
    spsValidator_sellTransactionIsValid(data),
    spsValidator_purchaseTransactionIsValid(data),
    spsValidator_dimOffsetPurchaseEvents(data),
    spsValidator_symbolsMatch(data),
    spsValidator_unitsMatch(data),
    spsValidator_currencyMatch(data),
    spsValidator_allEventsArePresent(data)
  ];

  const dataRange = helper.getRange(columns.first, rows.first, columns.last, rows.last);
  const colOffsets = columns.keys.reduce((map, key) => {
    map[key] = columns.colLabelToNumMap[key] - columns.first + 1;
    return map;
  }, {});

  helper.updateRunStatus(`Clearing existing validations`);
  clearExistingValidations({ ...data, dataRange, colOffsets });

  const rowValidationFailures = {};
  const tableValidationFailures = [];

  const [rowAndCellRules, tableAndColRules] = rules.reduce((all, rule) => {
    const index = [RULE_TYPE.CELL, RULE_TYPE.ROW].includes(rule.getConfig().type) ? 0 : 1;
    all[index].push(rule);
    return all;
  }, [[], []]);

  for (const rule of tableAndColRules) {

    const ruleConfig = rule.getConfig();
    const { name, targetCol } = ruleConfig;

    helper.updateRunStatus(`Validating that ${name}`);
    const colRange = targetCol ? helper.getColFromRange(dataRange, colOffsets[targetCol]) : undefined;

    if (!rule.validate({ ...data, colRange, dataRange, colOffsets })) {
      const { result } = rule.getResult();
      const message = typeof result === 'string' ? result : 'Validation failure'
      tableValidationFailures.push({
        ...ruleConfig,
        message,
        result,
        col: targetCol ? columns.colNumToLabelMap[targetCol] : undefined,
      });
    }
  }

  for (const rule of rowAndCellRules) {

    const ruleConfig = rule.getConfig();
    const { name, targetCol } = ruleConfig;

    helper.updateRunStatus(`Validating that ${name}`)

    helper.forEachRowInRange(dataRange, (rowRange, rowIndex) => {
      const targetCell = targetCol == null ? undefined : rowRange.getCell(1, colOffsets[targetCol]);
      const rowNum = rowRange.getRow();

      if (!rule.validate({ ...data, targetCell, rowRange, dataRange, colOffsets, rowIndex, rowNum })) {
        rowValidationFailures[rowNum] = rowValidationFailures[rowNum] || [];
        const { result } = rule.getResult();
        const message = typeof result === 'string' ? result : 'Validation failure'
        rowValidationFailures[rowNum].push({
          ...ruleConfig,
          message,
          result,
          col: targetCell ? columns.colNumToLabelMap[targetCol] : undefined,
          rowNum
        });
      }

    });
  }

  helper.updateRunStatus(`Applying validation results`);
  const rowValidationCounts = {};
  Object.keys(rowValidationFailures).forEach(rowNumString => {
    const rowNum = parseInt(rowNumString, 10);
    const validations = rowValidationFailures[rowNum];

    validations.forEach(validation => {
      rowValidationCounts[validation.level] = rowValidationCounts[validation.level] ?? 0;
      rowValidationCounts[validation.level]++;
    })

    applyValidations(
      { ...data, rowNum },
      filterValidations(validations)
    );
  });

  applyValidations(
    data,
    tableValidationFailures
  )

  helper.updateFinalStatus(makeFinalStatus(rowValidationCounts, tableValidationFailures));
}

const makeFinalStatus = (rowValidationCounts, tableValidationFailures) => {
  let count = rowValidationCounts[RULE_LEVEL.ERROR] ?? 0;
  if (count < 0) {
    throw new Error(`Unexpected error count (${count})`)
  }

  count += tableValidationFailures.length;
  const tableFailuresMessage = tableValidationFailures.length > 0 ? '\n(check notes on this cell for additional details)' : '';

  if (count === 0) {
    return;
  }

  if (count === 1) {
    return `1 validation error requires your attention${tableFailuresMessage}`
  }

  return `${count} validation errors require your attention${tableFailuresMessage}`
}

const clearExistingValidations = ({ dataRange, helper, columns, colOffsets, reporting }) => {
  helper.forEachCellInRange(dataRange, cell => {
    const note = cell.getNote();
    if (note && note.startsWith('[VALIDATION]')) {
      cell.setNote('');
    }
  });

  const formatCodeRange = helper.getColFromRange(dataRange, colOffsets[columns.FORMAT_CODE])
  formatCodeRange.clearContent();

  const statusCell = helper.getCell(reporting.status.col, reporting.status.row);
  statusCell.setNote('');
}

const filterValidations = (validations) => {
  // One ROW validation per row
  // One CELL validation per cell
  // Choose most severe of ERROR, WARN, GOOD, DIM

  const makeKey = ({ type, targetCol }) => {
    switch (type) {
      case RULE_TYPE.ROW:
        return type;
      case RULE_TYPE.CELL:
        return `${type}-${targetCol}`;
      case RULE_TYPE.COL:
        return ``;
      default:
        throw new Error(`Unhandled validation rule type ${type}`);
    }
  }

  const dict = validations.reduce((o, validation) => {
    const key = makeKey(validation);
    o[key] = o[key] ?? {};
    o[key][validation.level] = o[key][validation.level] ?? [];
    o[key][validation.level].push(validation);
    return o;
  }, {});

  const orderedLevels = [RULE_LEVEL.ERROR, RULE_LEVEL.WARNING, RULE_LEVEL.GOOD, RULE_LEVEL.DIM];

  return Object.keys(dict).map(key => {
    for (level of orderedLevels) {
      if (dict[key][level]) {
        return dict[key][level][0];
      }
    }
  });
}

const applyValidations = (data, validations) => {
  ``

  const { columns, helper, rowNum } = data;

  validations.forEach(validation => {
    switch (validation.type) {
      case RULE_TYPE.CELL:
        applyCellValidation(data, validation);
        break;
      case RULE_TYPE.ROW:
        applyRowValidation(data, validation);
        break;
      case RULE_TYPE.COL:
        applyColValidation(data, validation);
        break;
      default:
        throw new Error(`Unhandled validation rule type ${validation.type}`);
    }
  });

  if (rowNum != null) {
    const formatCode = makeFormatCode(data, validations);
    const formatCodeCell = helper.getCell(columns.FORMAT_CODE, rowNum);
    formatCodeCell.setValue(formatCode);
  }
}

const applyCellValidation = ({ helper }, { targetCol, rowNum, messageTarget, message }) => {
  const targetCell = helper.getCell(targetCol, rowNum);

  if (messageTarget !== MESSAGE_TARGET.COMMENT) {
    throw new Error('Only COMMENT message target type is supported right now')
  }

  targetCell.setNote(`[VALIDATION]: ${message}`);
}

const applyRowValidation = (data, validation) => {
  // nothing to see here
}

const applyColValidation = ({ helper, reporting }, { message }) => {
  const statusCell = helper.getCell(reporting.status.col, reporting.status.row);
  const note = statusCell.getNote();
  statusCell.setNote(note + '\n\n' + message);
}

const makeFormatCode = ({ columns }, validations) => {
  const levelCodes = {
    ERROR: 'E',
    WARNGING: 'W',
    GOOD: 'G',
    DIM: 'D',
  }

  return validations.map(({ type, level, targetCol }) => {
    const code = levelCodes[level];
    if (code == null) {
      throw new Error(`Unhandled validation rule level ${level}`)
    }

    switch (type) {
      case RULE_TYPE.CELL:
        return `${code}${columns.colLabelToNumMap[targetCol]},`;
      case RULE_TYPE.ROW:
        return `${code},`;
      case RULE_TYPE.COL:
        return ``;
      default:
        throw new Error(`Unhandled validation rule type ${type}`);
    }
  }).join('');
}
