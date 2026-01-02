function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function includeCommon() {
  return [
    // this may need to move to the header at some point
    include('html/common_stylesheet'),
    include('html/spinner'),
    include('html/alert'),
    include('html/common_javascript')
  ].join('\n');
}

function apiResponse(value) {
  if (value == null) {
    return {};
  }

  return { value: JSON.stringify(value) };
}

const formatToYYYYMMDD = (date) => {
  if (typeof date === 'string') {
    // try to convert it to a date - a valid usecase would be TZ included
    date = new Date(date);
  }
  
  const format = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Note: en-CA (Canada) conveniently defaults to YYYY-MM-DD
  return format.format(date);
};
