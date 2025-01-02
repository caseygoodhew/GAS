const validationCellUpdater = (cellRef) => {
  const triggerOnEventName = 'validating';
  const myKey = '__validation';

  return {
    [myKey]: {
      cell: cellRef,
      setter: 'setRichTextValue',
      formatter: (status) => {
        const dimmed = SpreadsheetApp.newTextStyle()
                    .setUnderline(false)
                    .setBold(false)
                    .setItalic(true)
                    .setForegroundColor('#999999')
                    .build();

        const intro = 'Running validation script';

        return SpreadsheetApp.newRichTextValue()
                            .setText(`${intro}\n\n${status}`)
                            .setTextStyle(0, intro.length, dimmed)
                            .build();
      },
      onEvent: ({eventName, args, updater}) => {
        if (triggerOnEventName !== eventName) {
          return;
        }

        const [message] = args;

        updater.updateOne(myKey, message);
      }
    }
  }
} 