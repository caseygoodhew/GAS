/**
 * Opens the investment predictor modal.
 */
const showPredictorModal = () => {
  const html = HtmlService.createTemplateFromFile('html/predictor/html_main')
    .evaluate()
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Investment & Savings Predictor');
};

/**
 * STUB: Fetches initial setup data.
 */
const getInitialData = () => {
  // You will replace this with actual Spreadsheet/PropertiesService logic.
  return apiResponse({ 
    'SETUP': {
      owners: ["Self", "Partner"],
      accounts: [
        { id: 1, owner: "Self", name: "High Yield Savings", currency: "GBP", balance: 5000, aer: 4.5 }
      ],
      openingDate: new Date(2026, 0, 31)
    }
  });
};

/**
 * STUB: Saves the setup configuration.
 */
const saveSetupData = (data) => {
  console.log("Saving data:", data);

};