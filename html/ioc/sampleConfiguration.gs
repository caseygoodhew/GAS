function getSampleIOCConfiguration() {
  return [
  {
    "dateSameAs": "2",
    "byPerformance": "bottom",
    "endDate": "2025-12-29",
    "taxYear": "24/25",
    "dataSetMode": "performance",
    "dateRangeMode": "tax-year",
    "startDate": "2025-11-01",
    "dataSetSameAs": "",
    "lines": [
      {
        "dataSetLineMode": "all",
        "account": "TRADING_212",
        "symbols": []
      },
      {
        "dataSetLineMode": "account",
        "account": "CHARLES_SCHWAB",
        "symbols": [
          "META"
        ]
      },
      {
        "dataSetLineMode": "account",
        "account": "TRADING_212",
        "symbols": [
          "AMZN",
          "AZN",
          "BRBY"
        ]
      },
      {
        "symbols": [
          "META"
        ],
        "account": "CHARLES_SCHWAB",
        "dataSetLineMode": "holding"
      }
    ],
    "offsetPeriod": "1-week",
    "performanceFilter": "none"
  },
  {
    "dataSetMode": "same-as",
    "startDate": "2025-01-01",
    "dataSetSameAs": "1",
    "lines": [
      {
        "account": "CHARLES_SCHWAB",
        "dataSetLineMode": "all",
        "symbols": []
      },
      {
        "symbols": [],
        "account": "CHARLES_SCHWAB",
        "dataSetLineMode": "all"
      },
      {
        "account": "CHARLES_SCHWAB",
        "symbols": [
          "AAPL",
          "AZN",
          "DATA"
        ],
        "dataSetLineMode": "holding"
      },
      {
        "dataSetLineMode": "all",
        "symbols": [],
        "account": "CHARLES_SCHWAB"
      }
    ],
    "taxYear": "24/25",
    "offsetPeriod": "1-year",
    "performanceFilter": "",
    "endDate": "",
    "dateRangeMode": "fixed-start",
    "dateSameAs": "1",
    "byPerformance": ""
  },
  {
    "endDate": "",
    "startDate": "2024-01-01",
    "byPerformance": "",
    "taxYear": "24/25",
    "dataSetMode": "same-as",
    "dateSameAs": "1",
    "lines": [
      {
        "dataSetLineMode": "all",
        "account": "CHARLES_SCHWAB",
        "symbols": []
      },
      {
        "dataSetLineMode": "all",
        "symbols": [],
        "account": "CHARLES_SCHWAB"
      },
      {
        "account": "CHARLES_SCHWAB",
        "symbols": [],
        "dataSetLineMode": "all"
      },
      {
        "account": "CHARLES_SCHWAB",
        "symbols": [],
        "dataSetLineMode": "all"
      }
    ],
    "dataSetSameAs": "1",
    "performanceFilter": "",
    "offsetPeriod": "3-months",
    "dateRangeMode": "current"
  },
  {
    "dateRangeMode": "current",
    "endDate": "",
    "taxYear": "24/25",
    "performanceFilter": "",
    "lines": [
      {
        "symbols": [
          "RR"
        ],
        "dataSetLineMode": "holding",
        "account": "CHARLES_SCHWAB"
      },
      {
        "symbols": [
          "RKLB"
        ],
        "account": "CHARLES_SCHWAB",
        "dataSetLineMode": "holding"
      },
      {
        "symbols": [
          "APP"
        ],
        "account": "CHARLES_SCHWAB",
        "dataSetLineMode": "holding"
      },
      {
        "symbols": [
          "GOOG"
        ],
        "account": "CHARLES_SCHWAB",
        "dataSetLineMode": "holding"
      }
    ],
    "dataSetMode": "defined",
    "startDate": "2024-01-01",
    "dataSetSameAs": "1",
    "offsetPeriod": "1-year",
    "dateSameAs": "1",
    "byPerformance": ""
  }
]
}
