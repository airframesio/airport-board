// CUSTOMIZATION OPTIONS
sf.options = {
  // REQUIRED
  plugin: 'arrivals',           // Plugin to load
  container: $('#board'),       // Where in the DOM to put the board
  template: $('#row_template'), // Where in the DOM to find the row template
  numRows: 6,                  // number of rows

  // OPTIONAL
  sort: 'timeString',  // the column to sort by
  order: 'asc',        // the order to sort by
  maxResults: 26,      // number of items to retrieve from service
  pageInterval: 30000, // delay between pages (ms)
  stagger: 1500,       // delay between loading rows (ms)
  pagination:$('.pagination'),

  // PASS DATA TO FRONTEND UI
  airframesData: airframesData
};

$(document).ready(function() {
  sf.board.init(sf.options);
  sf.items.init(sf.options);
  sf.items.load(sf.options);
});
