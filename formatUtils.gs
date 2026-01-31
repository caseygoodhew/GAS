const testSampleFormat = () => {
  const helper = makeHelper('2yr Detailed Accounting');
  //const range = helper.getRange('B', 2, 'C', 8);
  const result = formatUtils().sampleFormats(helper, {
    sectionHeader: { address: 'B2', types: ['font'] },
    accountHeader: { address: 'C2', types: ['font'] },
    dateColumn: { address: 'B8', types: ['background', 'font', 'number'] },
    descriptionColumn: { address: 'E8', types: ['background', 'font', 'number'] },
    amountColumn: { address: 'F8', types: ['background', 'font', 'number'] },
    amountUSD: { address: 'G8', types: ['number'] },
    accountColumn: { address: 'G8', types: ['background', 'font', 'number'] },
    commonConditionals: { address: 'B8', types: ['conditional'] },
    equityAccountConditionals: { address: 'G8', types: ['conditional'] },
    debtAccountConditionals: { address: 'Y8', types: ['conditional'] },
    equitySumColumn: { address: 'AB8', types: ['background', 'font', 'number'] },
    netWorthSumColumn: { address: 'AC8', types: ['background', 'font', 'number'] }
  });

  console.log(JSON.stringify(result, undefined, 2));

  debugger;
}

const formatUtils = () => {

  const funcs = {
    sampleFormats: (helper, map) => {
      return Object.keys(map).reduce((out, key) => {
        const item = map[key];
        const range = helper.getRangeFromA1(item.address);
        return { ...out, [key]: funcs.sampleCellFormat(range, item.types) }
      }, {});
    },

    sampleCellFormat: (cellRange, types) => {
      return types.reduce((out, type) => {
        switch (type) {
          case 'background':
            return { 
              ...out, 
              background: cellRange.getBackgrounds()[0][0] 
            };
          
          case 'font':
            return { 
              ...out, 
              fontColor: cellRange.getFontColors()[0][0],
              fontWeight: cellRange.getFontWeights()[0][0] 
            };

          case 'number':
            return {
              ...out,
              numberFormat: cellRange.getNumberFormats()[0][0]
            };

          case 'conditional':
            return {
              ...out,
              conditional: funcs.getConditionalFormattingRulesForCell(cellRange)
            }

          default:
            throw new Error(`Unknown sample format type "${type}"`)
        }
      }, {});
    },

    getConditionalFormattingRulesForCell: (cellRange) => {
      const sheet = cellRange.getSheet();
      const targetRow = cellRange.getRow();
      const targetCol = cellRange.getColumn();
      const allRules = sheet.getConditionalFormatRules();

      // Filter rules to find only those that include the target cell
      return allRules
        .filter((rule) => {
          const ranges = rule.getRanges();
          return ranges.some((range) => {
            const startRow = range.getRow();
            const endRow = startRow + range.getNumRows() - 1;
            const startCol = range.getColumn();
            const endCol = startCol + range.getNumColumns() - 1;

            return (
              targetRow >= startRow &&
              targetRow <= endRow &&
              targetCol >= startCol &&
              targetCol <= endCol
            );
          });
        })
        .map((rule) => {
          // Codify the rule into a serialisable object
          const booleanCondition = rule.getBooleanCondition();
          
          return {
            type: booleanCondition ? 'BOOLEAN' : 'GRADIENT',
            // Store ranges in numeric R1C1 format
            ranges: rule.getRanges().map(r => ({
              row: r.getRow(),
              col: r.getColumn(),
              numRows: r.getNumRows(),
              numCols: r.getNumColumns()
            })),
            criteria: booleanCondition ? {
              type: booleanCondition.getCriteriaType().toString(),
              values: booleanCondition.getCriteriaValues(),
              background: booleanCondition.getBackground(),
              fontColor: booleanCondition.getFontColor(),
              bold: booleanCondition.getBold()
            } : null
            // Note: You can expand this to capture GradientCondition details if needed
          };
        });
    },

    applyFormatting: (_rules, range) => {
      const rules = isArray(_rules) ? _rules : [_rules];

      rules.forEach(rule => {
        Object.keys(rule).forEach(key => {
          switch (key) {
            case 'background':
              range.setBackgroundColor(rule[key]);
              break;

            case 'fontColor':
              range.setFontColor(rule[key]);
              break;

            case 'fontWeight':
              range.setFontWeight(rule[key]);
              break;

            case 'numberFormat':
              range.setNumberFormat(rule[key]);
              break;

            case 'conditional':
              funcs.applyConditionalFormatting(rule[key], range);
              break;

            default:
              throw new Error(`Unknown format type "${key}"`)
          }
        })
      })
    },

    applyConditionalFormatting: (rule, range) => {
      const sheet = range.getSheet();
      const builder = SpreadsheetApp.newConditionalFormatRule();
      const criteria = rule.criteria;

      const val = criteria.values;
      switch (criteria.type) {
        // --- Text Comparisons ---
        case 'TEXT_CONTAINS':
          builder.whenTextContains(val[0]);
          break;
        case 'TEXT_DOES_NOT_CONTAIN':
          builder.whenTextDoesNotContain(val[0]);
          break;
        case 'TEXT_STARTS_WITH':
          builder.whenTextStartsWith(val[0]);
          break;
        case 'TEXT_ENDS_WITH':
          builder.whenTextEndsWith(val[0]);
          break;
        case 'TEXT_IS_EQUAL_TO':
          builder.whenTextEqualTo(val[0]);
          break;

        // --- Numeric Comparisons ---
        case 'NUMBER_GREATER_THAN':
          builder.whenNumberGreaterThan(Number(val[0]));
          break;
        case 'NUMBER_GREATER_THAN_OR_EQUAL_TO':
          builder.whenNumberGreaterThanOrEqualTo(Number(val[0]));
          break;
        case 'NUMBER_LESS_THAN':
          builder.whenNumberLessThan(Number(val[0]));
          break;
        case 'NUMBER_LESS_THAN_OR_EQUAL_TO':
          builder.whenNumberLessThanOrEqualTo(Number(val[0]));
          break;
        case 'NUMBER_EQUAL_TO':
          builder.whenNumberEqualTo(Number(val[0]));
          break;
        case 'NUMBER_NOT_EQUAL_TO':
          builder.whenNumberNotEqualTo(Number(val[0]));
          break;
        case 'NUMBER_BETWEEN':
          builder.whenNumberBetween(Number(val[0]), Number(val[1]));
          break;
        case 'NUMBER_NOT_BETWEEN':
          builder.whenNumberNotBetween(Number(val[0]), Number(val[1]));
          break;

        // --- Date Comparisons ---
        case 'DATE_BEFORE':
          builder.whenDateBefore(val[0]);
          break;
        case 'DATE_AFTER':
          builder.whenDateAfter(val[0]);
          break;
        case 'DATE_ON_OR_BEFORE':
          builder.whenDateBeforeOrEqualTo(val[0]);
          break;
        case 'DATE_ON_OR_AFTER':
          builder.whenDateAfterOrEqualTo(val[0]);
          break;

        // --- Empty/Error Checks ---
        case 'CELL_EMPTY':
          builder.whenCellEmpty();
          break;
        case 'CELL_NOT_EMPTY':
          builder.whenCellNotEmpty();
          break;
        case 'TEXT_IS_VALID_EMAIL':
          builder.whenTextIsEmail();
          break;
        case 'TEXT_IS_VALID_URL':
          builder.whenTextIsUrl();
          break;

        // --- Custom Formula ---
        case 'CUSTOM_FORMULA':
          builder.whenFormulaSatisfied(val[0]);
          break;

        default:
          console.warn(`Unsupported criteria type: ${criteria.type}`);
      }

      // 2. Set the Styling
      if (criteria.background) builder.setBackground(criteria.background);
      if (criteria.fontColor) builder.setFontColor(criteria.fontColor);
      if (criteria.bold) builder.setBold(true);

      // 3. Finalise the Rule
      const newRule = builder.setRanges([range]).build();

      // 4. Update the Sheet's rule list
      const rules = sheet.getConditionalFormatRules();
      rules.push(newRule);
      sheet.setConditionalFormatRules(rules);
    }
  };

  return funcs;

}
