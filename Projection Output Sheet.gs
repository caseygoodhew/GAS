const testProjectionsOutputSheet = () => {
  const data = projectionOutputSheet().refresh();
  debugger;
}

const projectionOutputSheet = () => {
  
  const PROJECT_OVER_YEARS = 3;

  const getFormatRules = () => {
    return {
      "sectionHeader": {
        "fontColor": "#000000",
        "fontWeight": "bold"
      },
      "accountHeader": {
        "fontColor": "#000000",
        "fontWeight": "bold"
      },
      "dateColumn": {
        "background": "#ffffff",
        "fontColor": "#000000",
        "fontWeight": "normal",
        "numberFormat": "d\"-\"mmm\"-\"yy"
      },
      "descriptionColumn": {
        "background": "#ffffff",
        "fontColor": "#000000",
        "fontWeight": "normal",
        "numberFormat": "0.###############"
      },
      "amountColumn": {
        "background": "#ffffff",
        "fontColor": "#000000",
        "fontWeight": "normal",
        "numberFormat": "[$£]#,##0"
      },
      "amountUSD": {
        "numberFormat": "[$$]#,##0"
      },
      "accountColumn": {
        "background": "#ffffff",
        "fontColor": "#000000",
        "fontWeight": "normal",
        "numberFormat": "[$£]#,##0"
      },
      "equitySumColumn": {
        "background": "#ffffff",
        "fontColor": "#000000",
        "fontWeight": "bold",
        "numberFormat": "[$£]#,##0"
      },
      "netWorthSumColumn": {
        "background": "#ffffff",
        "fontColor": "#000000",
        "fontWeight": "bold",
        "numberFormat": "[$£]#,##0"
      },
      "conditionals": {
        "dimHistoric": ({range}) => ({
          "name": "Dim historic event backgrounds",
          "type": "BOOLEAN",
          "criteria": {
            "type": "CUSTOM_FORMULA",
            "values": [
              // "=AND(NOT(ISBLANK($B4)), $B4 < now())"
              convertRcToA1(`=AND(NOT(ISBLANK(RC${range.getColumn()})), RC${range.getColumn()} < now())`, range.getRow(), range.getColumn())
            ],
            "background": "#F3F3F3",
            "fontColor": null,
            "bold": null
          }
        }),
        "redAmount": () => ({
          "name": "Amount in the Red",
          "type": "BOOLEAN",
          "criteria": {
            "type": "NUMBER_LESS_THAN",
            "values": [
              0
            ],
            "background": "#FF0000",
            "fontColor": "#FFFFFF",
            "bold": null
          }
        }),
        "dimConsistentAmounts": ({ range }) => ({
          "name": "Dim consistent amount",
          "type": "BOOLEAN",
          "criteria": {
            "type": "CUSTOM_FORMULA",
            "values": [
              //"=G4=G5"
              convertRcToA1("=RC=R[1]C", range.getRow(), range.getColumn())
            ],
            "background": null,
            "fontColor": "#B7B7B7",
            "bold": null
          }
        }),
        "highlightChangedAmounts": ({ range }) => ({
          "name": "Highlight amount changes",
          "type": "BOOLEAN",
          "criteria": {
            "type": "CUSTOM_FORMULA",
            "values": [
              //"=G4<>G5"
              convertRcToA1("=RC<>R[1]C", range.getRow(), range.getColumn())
            ],
            "background": null,
            "fontColor": null,
            "bold": true
          }
        })
      }
    };
  }

  const PROJECTION_OUTPUT_SHEETNAME = 'Projection Output'
  const helper = makeHelper(PROJECTION_OUTPUT_SHEETNAME);

  const {
    WHO,
    TYPE,
    FROM_ACCOUNT,
    TO_ACCOUNT,
    START_DATE,
    END_DATE,
    RECURRENCE,
    AMOUNT,
  } = projectionsSheet.getColumns();

  const makeRecurrenceOf = (store, item, firstDate, maxDate, nextDateFn) => {
    let date = firstDate;
    while (date <= maxDate) {
      const key = ''+date.valueOf();
      store[key] = store[key] || { date, items: [] };
      store[key].items.push(item);
      date = nextDateFn(date);
    }
  }

  const makeSchedule = () => {
    const data = projectionsSheet.getData();
    
    const {
      opening,
      scheduled
    } = data.reduce((groups, item) => {
      if (['Opening'].includes(item[TYPE])) {
        groups.opening.push(item);
      } else {
        groups.scheduled.push(item);
      }
      return groups;
    }, { opening: [], scheduled: [] });
    
    const now = new Date();
    const defaultEnd = addYears(now, PROJECT_OVER_YEARS);
    const store = {};
    const oneTimeOnly = (store, item, date) => makeRecurrenceOf(
      store,
      item, 
      date, 
      defaultEnd, 
      () => addDays(defaultEnd, 1)
    );

    opening.forEach(item => oneTimeOnly(store, item, now));

    scheduled.forEach(item => {
      switch (item[RECURRENCE]) {
        case 'One time only':
          oneTimeOnly(store, item, item[START_DATE]);
          break;

        case 'Monthly':
          makeRecurrenceOf(
            store,
            item, 
            item[START_DATE], 
            item[END_DATE] || defaultEnd, 
            (date) => addMonths(date, 1)
          );
          break;

        case 'Quarterly':
          makeRecurrenceOf(
            store,
            item, 
            item[START_DATE], 
            item[END_DATE] || defaultEnd, 
            (date) => addMonths(date, 3)
          );
          break;

        case 'Yearly':
          makeRecurrenceOf(
            store,
            item, 
            item[START_DATE], 
            item[END_DATE] || defaultEnd, 
            (date) => addYears(date, 1)
          );
          break;
      }
    });

    const bulkableTypes = ['Opening', 'Interest Growth'];
    const schedule = Object.values(store)
      .filter(item => item.date >= now && item.date <= defaultEnd)
      .sort((a, b) => b.date.valueOf() - a.date.valueOf())
      // collect "bulk" update items
      .map(rec => {
        const grouped = rec.items.reduce((acc, item) => {
          if (bulkableTypes.includes(item[TYPE])) {
            acc[item[TYPE]] = acc[item[TYPE]] || [];
            acc[item[TYPE]].push(item);
          } else {
            acc.other.push(item);
          }
          return acc;
        }, { other: [] });

        const keys = Object.keys(grouped).filter(key => key !== 'other');

        return [
          ...keys.map(key => ({ ...rec, bulk: true, items: grouped[key] })),
          { ...rec, items: grouped.other }
        ].filter(rec => rec.items.length > 0)
      })
      .flat();

    return schedule;
  }

  const calculateFormula = (pinnedRow, modifier) => {
    return `=${modifier??''}INDEX(OFFSET(RC,1,0,ROW(R${pinnedRow}C)-ROW(),1),MATCH(FALSE,ISBLANK(OFFSET(RC,1,0,ROW(R${pinnedRow}C)-ROW(),1)),0))`;
  }

  const setDefaultFormula = (pinnedRow) => {
    return calculateFormula(pinnedRow);
  }

  const prepareEquityFormula = (equityColumns, exchangeRateCol) => {
    const usdEquityColumnNums = equityColumns.keys
        .filter(key => key.includes('USD'))
        .map(key => equityColumns.colLabelToNumMap[key]);

    const usdR1C1Frag = usdEquityColumnNums.map(col => `RC${col}`).join(' + ')

    // =sum(G120:X120)-((1-AA120) * (G120+J120+S120+U120))
    return () => `=SUM(RC${equityColumns.first}:RC${equityColumns.last})-((1-RC${exchangeRateCol}) * (${usdR1C1Frag}))`
  }

  const prepareNetWorthFormula = (debtColumns, equityTotalColNum) => {
    // =AB120+sum(Y120:Z120)
    return () => `=RC${equityTotalColNum}+SUM(RC${debtColumns.first}:RC${debtColumns.last})`;
  }

  const addAmountFormula = (pinnedRow, amountCol) => {
    return calculateFormula(pinnedRow, `RC${toColNumber(amountCol)} + `);
  }

  const subtractAmountFormula = (pinnedRow, amountCol) => {
    return calculateFormula(pinnedRow, `(-1 * RC${toColNumber(amountCol)}) + `);
  }

  const addUSDtoGBPAmountFormula = (pinnedRow, amountCol, exchangeRateCol) => {
    return calculateFormula(pinnedRow, `(RC${toColNumber(amountCol)} * RC${toColNumber(exchangeRateCol)}) + `);
  }

  const applyInterestFormula = (pinnedRow, aer, recurrence) => {
    const multiplier = (() => {
      switch (recurrence) {
        case 'One time only':
          throw new Error(`Interest rates cannot be applied on a "One time only" basis`);
        case 'Monthly':
          return (1 + aer) ** (1/12);
        case 'Quarterly':
          return (1 + aer) ** (1/4);
        case 'Yearly':
          return (1 + aer);
        default:
          throw new Error(`Unknonw interest recurrence "${recurrence}"`);
      }
    })();

    return calculateFormula(pinnedRow, `${multiplier} * `);
  }
  
  /*const fillFormulaRange = () => {
    const topLeft = { col: 3, row: 5 }
    const rows = 10;
    const cols = 10;
    const pinnedRow = topLeft.row + rows;
    const modifier = '1+';
    // Create a 10x10 array where every cell points to the row below it
    // Example: If this is in A1, it acts like =A2
    const formulaValue = calculateFormula(pinnedRow, modifier);
    
    const formulaData = Array.from({ length: rows }, () => 
      Array.from({ length: cols }, () => formulaValue)
    );

    // Apply the entire 2D array to the range in one go
    helper.getRangeBySize(topLeft.col, topLeft.row, cols, rows).setFormulasR1C1(formulaData);
  };*/

  const makeDynamicColKey = (section, account) => {
    return `${section.trim()} - ${account.trim()}`;
  }

  const calculateDynamicColumns = (firstDynamicColumn, data) => {
    
    const addKeys = (map, ...keys) => {
      keys.forEach(key => {
        if (!key.trim()) {
          return;
        }
        map[key.trim()] = true;
      });
    }
    
    const colMap = [...data].reverse().reduce((map, rec) => {
      return rec.items.reduce((map, item) => {
        map[item[WHO]] = map[item[WHO]] || {};
        addKeys(map[item[WHO]], item[FROM_ACCOUNT], item[TO_ACCOUNT]);
        return map;
      }, map);
    }, {});

    const allCols = [];
    const equityCols = [];
    const debtCols = [];
    const otherCols = [];

    const equityColumns = Object.keys(colMap).filter(key => !['Debt', 'XRate'].includes(key));

    equityColumns.forEach(sectionKey => {
      Object.keys(colMap[sectionKey]).forEach(accountKey => {
        allCols.push(makeDynamicColKey(sectionKey, accountKey));
        equityCols.push(makeDynamicColKey(sectionKey, accountKey));
      });
    });
    
    Object.keys(colMap['Debt']).forEach(accountKey => {
      allCols.push(makeDynamicColKey('Debt', accountKey));
      debtCols.push(makeDynamicColKey('Debt', accountKey));
    });

    Object.keys(colMap['XRate']).forEach(accountKey => {
      allCols.push(makeDynamicColKey('XRate', accountKey));
      otherCols.push(makeDynamicColKey('XRate', accountKey));
    });
    
    return {
      allDynamicColumns: defineLabelledColumns(firstDynamicColumn, allCols),
      equityColumns: defineLabelledColumns(firstDynamicColumn, equityCols),
      debtColumns: defineLabelledColumns(firstDynamicColumn + equityCols.length, debtCols),
      otherColumns: defineLabelledColumns(firstDynamicColumn + equityCols.length + debtCols.length, otherCols),
    };
  }

  const funcs = {
    refresh: () => {
      const data = makeSchedule();

      const startRow = 2;
      const headerRowCount = 2;
      const dataRowCount = data.reduce((count, rec) => count + (rec.bulk ? 1 : rec.items.length), 0);
      const firstDataRow = startRow + headerRowCount;
      const lastDataRow = firstDataRow + dataRowCount - 1;

      const firstColNum = toColNumber('B');
      const fixedStartColumns = defineLabelledColumns(firstColNum, ['DATE', 'DESCRIPTION', 'AMOUNT']);
      
      const { 
        allDynamicColumns,
        equityColumns,
        debtColumns,
        otherColumns
      } = calculateDynamicColumns(fixedStartColumns.last + 1, data);
      
      const fixedEndColumns = defineLabelledColumns(allDynamicColumns.last + 1, ['EQUITY', 'NET_WORTH']);
      const allColumns = defineLabelledColumns(firstColNum, [
        ...fixedStartColumns.keys,
        ...allDynamicColumns.keys,
        ...fixedEndColumns.keys
      ]);

      const { DATE, DESCRIPTION, AMOUNT, EQUITY, NET_WORTH } = allColumns;

      const exchangeRateColNum = otherColumns.colLabelToNumMap[makeDynamicColKey('XRate', 'USDGBP')];
      const calculateEquityFormula = prepareEquityFormula(equityColumns, exchangeRateColNum);
      const cacluclateNetWorthFormula = prepareNetWorthFormula(debtColumns, allColumns.colLabelToNumMap[EQUITY]);
      
      const grid = [];
      for (let r = firstDataRow; r <= lastDataRow; r++) {
        const row = [];
        grid.push(row);
        
        for (let c = allDynamicColumns.first; c <= allColumns.last; c++) {
          if (r === lastDataRow && c <= allDynamicColumns.last) {
            row.push('=0');
            continue;
          }

          if (c < fixedEndColumns.first) {
            row.push(setDefaultFormula(lastDataRow));
            continue;
          }

          if (c === allColumns.colLabelToNumMap[EQUITY]) {
            row.push(calculateEquityFormula())

          }

          if (c === allColumns.colLabelToNumMap[NET_WORTH]) {
            row.push(cacluclateNetWorthFormula());
          }
        }
      }

      const makeLeftRows = (date, description, amount) => {
        const offset = -fixedStartColumns.first;
        const array = Array(fixedStartColumns.last - fixedStartColumns.first + 1).fill("");
        array[fixedStartColumns.colLabelToNumMap[DATE] + offset] = date;
        array[fixedStartColumns.colLabelToNumMap[DESCRIPTION] + offset] = description;
        array[fixedStartColumns.colLabelToNumMap[AMOUNT] + offset] = amount;
        return array;
      };

      const updateGrid = (rowIndex, section, account, value) => {
        const key = makeDynamicColKey(section, account);
        const offset = allDynamicColumns.first;
        const colIndex = allDynamicColumns.colLabelToNumMap[key] - offset;
        grid[rowIndex][colIndex] = value;
      }

      let curRow = grid.length - 1;
      const fixedStartValues = [...data].reverse().reduce((fixed, rec) => {
        
        if (rec.bulk) {
          fixed.push(makeLeftRows(rec.date, rec.items[0][TYPE], ""));
          rec.items.forEach(item => {
            switch (item[TYPE]) {
              case 'Opening':
                updateGrid(curRow, item[WHO], item[TO_ACCOUNT], item[AMOUNT]);
                break;
              case 'Interest Growth':
                const aer = projectionsSheet.getInterestRatesFor(item[TO_ACCOUNT]);
                updateGrid(curRow, item[WHO], item[TO_ACCOUNT], 
                  applyInterestFormula(lastDataRow, aer, item[RECURRENCE])
                );
                break;
              default:
                throw new Error(`Unknown bulk update type "${item[TYPE]}"`)
            }
          });
          curRow--;
        } else {
          rec.items.forEach(item => {
            
            item.row = curRow;
            fixed.push(makeLeftRows(rec.date, `${item[WHO]} ${item[TYPE]}`, item[AMOUNT]));
            
            if (item[FROM_ACCOUNT]) {
              if (item[TO_ACCOUNT].includes('USD') && !item[FROM_ACCOUNT].includes('USD')) {
                throw new Error(`Functionality not implemented to move money from GBP to USD`)
              }
              updateGrid(curRow, item[WHO], item[FROM_ACCOUNT], 
                subtractAmountFormula(lastDataRow, allColumns.colLabelToNumMap[AMOUNT])
              );
            } 

            if (item[TO_ACCOUNT]) {
              if (item[FROM_ACCOUNT].includes('USD') && !item[TO_ACCOUNT].includes('USD')) {
                updateGrid(curRow, item[WHO], item[TO_ACCOUNT], 
                  addUSDtoGBPAmountFormula(lastDataRow, allColumns.colLabelToNumMap[AMOUNT], exchangeRateColNum)
                );
              } else {
                updateGrid(curRow, item[WHO], item[TO_ACCOUNT], 
                  addAmountFormula(lastDataRow, allColumns.colLabelToNumMap[AMOUNT])
                );
              }
            }

            curRow--;
          });
        }

        return fixed;
      }, []).reverse();

      const headerObj = [...data].reverse().reduce((acc, rec) => {
        return rec.items.reduce((obj, item) => {
          const section = item[WHO].trim();
          const toAccount = item[TO_ACCOUNT].trim();
          const fromAccount = item[FROM_ACCOUNT].trim();
          
          obj[section] = obj[section] || [];
          if (toAccount && !obj[section].includes(toAccount)) {
            obj[section].push(toAccount);
          }
          if (fromAccount && !obj[section].includes(fromAccount)) {
            obj[section].push(fromAccount);
          }
          return obj;
        }, acc)
      }, {
        'Events': fixedStartColumns.keys.map(col => toTitleCase(col)),
      });
      headerObj[''] = fixedEndColumns.keys.map(col => toTitleCase(col));

      const sizedHeaderArray = Array(allColumns.last - allColumns.first + 1).fill('');
      let headerValueIndex = 0;
      const headerValues = Object.keys(headerObj).reduce((arr, key) => {
        if (key !== 'XRate') {
          arr[0][headerValueIndex] = key;
        }
        headerObj[key].forEach(account => {
          arr[1][headerValueIndex++] = account;
        });
        return arr;
      }, [[...sizedHeaderArray], [...sizedHeaderArray]])

      manuallyCalculate(data);

      helper.resetSheet();
      helper.getRange(allColumns.first, startRow, allColumns.last, startRow + 1).setValues(headerValues);
      helper.getRange(fixedStartColumns.first, firstDataRow, fixedStartColumns.last, lastDataRow).setValues(fixedStartValues);
      console.log('setting R1C1 formulas')
      helper.getRange(allDynamicColumns.first, firstDataRow, allColumns.last, lastDataRow).setFormulasR1C1(grid);
      helper.padSheet('br');
      helper.freezeView(firstDataRow-1, allDynamicColumns.first-1)

      /**************
       * APPLY THE FORMATTING
       */
      const formatting = getFormatRules();
      
      formatUtils().applyFormatting(
        formatting.sectionHeader, 
        helper.getRange(allColumns.first, startRow, allColumns.last, startRow)
      );

      formatUtils().applyFormatting(
        formatting.accountHeader, 
        helper.getRange(allColumns.first, startRow + 1, allColumns.last, startRow + 1)
      );
      formatUtils().applyFormatting(
        formatting.dateColumn,
        helper.getRange(allColumns.colLabelToNumMap[DATE], firstDataRow, allColumns.colLabelToNumMap[DATE], lastDataRow)
      );
      
      formatUtils().applyFormatting(
        formatting.descriptionColumn,
        helper.getRange(allColumns.colLabelToNumMap[DESCRIPTION], firstDataRow, allColumns.colLabelToNumMap[DESCRIPTION], lastDataRow)
      );
      
      formatUtils().applyFormatting(
        formatting.amountColumn,
        helper.getRange(allColumns.colLabelToNumMap[AMOUNT], firstDataRow, allColumns.colLabelToNumMap[AMOUNT], lastDataRow)
      );

      /*formatUtils().applyFormatting(
        formatting.amountUSD,
        helper.getRange(1, 2, 3, 4)
      );*/
      
      formatUtils().applyFormatting(
        formatting.accountColumn,
        helper.getRange(allDynamicColumns.first, firstDataRow, allDynamicColumns.last, lastDataRow)
      );

      allDynamicColumns.keys.forEach(key => {
        if (!key.includes('USD')) {
          return;
        }

        formatUtils().applyFormatting(
          formatting.amountUSD,
          helper.getRange(allDynamicColumns.colLabelToNumMap[key], firstDataRow, allDynamicColumns.colLabelToNumMap[key], lastDataRow)
        );
      });
      
      formatUtils().applyFormatting(
        formatting.equitySumColumn,
        helper.getRange(allColumns.colLabelToNumMap[EQUITY], firstDataRow, allColumns.colLabelToNumMap[EQUITY], lastDataRow)
      );
      
      formatUtils().applyFormatting(
        formatting.netWorthSumColumn,
        helper.getRange(allColumns.colLabelToNumMap[NET_WORTH], firstDataRow, allColumns.colLabelToNumMap[NET_WORTH], lastDataRow)
      );

      const applyConditionalFormatting = (name, range) => {
        const fn = formatting.conditionals[name];
        const rule = fn({ range });
        formatUtils().applyFormatting({ conditional: rule }, range);
      }

      applyConditionalFormatting(
        'dimHistoric', 
        helper.getRange(allColumns.first, firstDataRow, allColumns.last, lastDataRow)
      );

      applyConditionalFormatting(
        'redAmount', 
        helper.getRange(equityColumns.first, firstDataRow, equityColumns.last, lastDataRow)
      );

      applyConditionalFormatting(
        'dimConsistentAmounts', 
        helper.getRange(allDynamicColumns.first, firstDataRow, allDynamicColumns.last, lastDataRow)
      );

      applyConditionalFormatting(
        'highlightChangedAmounts', 
        helper.getRange(allDynamicColumns.first, firstDataRow, allDynamicColumns.last, lastDataRow)
      );

      const manualCalc = manuallyCalculate(data);
      
      console.log('done')
    }
  }
  
  const manuallyCalculate = _data => {
    const data = [..._data].reverse();
    
    const addAmount = (acc, section, account, amount) => {
      if (!account.length) {
        return;
      }
      
      const key = makeDynamicColKey(section, account);
      
      acc[key] = acc[key] || 0;
      acc[key] += amount;
    }

    const subtractAmount = (acc, section, account, amount) => {
      addAmount(acc, section, account, -1*amount);
    }

    const usdToGbp = (acc, amount) => {
      return amount * acc['XRate - USDGBP'];
    }

    const applyInterestGrowth = (acc, section, account, recurrence) => {
      if (!account.length) {
        return;
      }

      const aer = projectionsSheet.getInterestRatesFor(account);
      const key = makeDynamicColKey(section, account);
      
      const multiplier = (() => {
        switch (recurrence) {
          case 'One time only':
            throw new Error(`Interest rates cannot be applied on a "One time only" basis`);
          case 'Monthly':
            return (1 + aer) ** (1/12);
          case 'Quarterly':
            return (1 + aer) ** (1/4);
          case 'Yearly':
            return (1 + aer);
          default:
            throw new Error(`Unknonw interest recurrence "${recurrence}"`);
        }
      })();
      
      
      
      acc[key] = acc[key] || 0;
      acc[key] *= multiplier;
    }

    const accounting = data.reduce((_acc, rec) => {
      return rec.items.reduce((acc, item) => {
        const type = item['TYPE'];
        const section = item['WHO'];
        const fromAccount = item['FROM_ACCOUNT'];
        const toAccount = item['TO_ACCOUNT'];
        const amount = item['AMOUNT'];
        
        switch (type) {
          case 'Opening': 
            if (fromAccount.length) {
              throw new Error('Expected FROM ACCOUNT to be empty')
            }
            
            const key = makeDynamicColKey(section, toAccount);
            
            if (acc[key]) {
              throw new Error(`Section "${section}", account "${toAccount}" already contains a value`)
            }

            acc[key] = amount;

            break;

          case 'Interest Growth':
            if (fromAccount.length) {
              throw new Error('Expected FROM ACCOUNT to be empty')
            }

            applyInterestGrowth(acc, section, toAccount, item['RECURRENCE']);
            break;

          case 'Personal':
          case "Mortgage Reduction":
          case 'Pension':
          case 'RSU Grant':
          case 'Sell META':
          case 'Move':
          case 'NS&I':
          case 'To Yula':
          case 'From Casey':
          case 'Invest in Fund':
          case 'Pay':
          case 'Monthly Bills':
          case 'Bonus':
          case 'Holiday Spend':
          case 'Sell T212':
          case 'Kids ISAs':
          case 'Invest Vanguard':
          case 'Sell US Stock':
          case 'Move money to UK':
          case 'Mortgage Lump Sum':
            // not a great way - should be improved in the future
            const fromUSD = fromAccount.length && fromAccount.includes('USD');
            const toGBP = toAccount.length && !toAccount.includes('USD');

            const isUSDtoGBP = fromUSD && toGBP;
            
            subtractAmount(acc, section, fromAccount, amount);
            addAmount(acc, section, toAccount, isUSDtoGBP ? usdToGbp(acc, amount) : amount);
            break;

          default:
            debugger;
            throw new Error(type)
        }

        return acc;

      }, _acc)
    }, {});

    console.log(JSON.stringify(accounting, undefined, 2))

    debugger;
  }

  return funcs;
};



