const showIOCSetupDialog = () => {
  const fileName = 'html/ioc/setupDialog';
  SpreadsheetApp.getUi().showModalDialog(
    //HtmlService.createHtmlOutputFromFile(fileName), 
    HtmlService.createTemplateFromFile(fileName).evaluate(),
    'Dialog title'
  );
}

const submitIOCSetupDialogData = (num) => {
  //throw new Error('aaa')
  return num + 1;
}