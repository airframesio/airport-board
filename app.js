/* global require console process Promise module */
const moment = require('moment-timezone');
const express = require('express'), app = express();
require('dotenv').config();

const port = process.env.PORT || 8080;
const aviationStackAccessKey = process.env.AVIATION_STACK_ACCESS_KEY;
const laminarUserKey = process.env.LAMINAR_USER_KEY;

function addHoursToDate(date, hours) {
  return new Date(new Date(date).setHours(date.getHours() + hours));
}

function fetchFromAviationStack(airport, type, accessKey) {
  var axios = require('axios');
  let results = [];
  let airportFilter = type == 'arrivals' ? 'arr_icao=' + airport : 'dep_icao=' + airport;
  var badFlightStatuses = ['cancelled', 'incident', 'diverted'];
  let config = {
    method: 'get',
    url: 'http://api.aviationstack.com/v1/flights?access_key=' + accessKey + '&' + airportFilter
  };
  var now = new Date();
  console.log(now.toUTCString() + ": " + config.url);

  return axios(config)
    .then(function (response) {
      // console.log(JSON.stringify(response.data));

      var now = new Date();
      var kordtime = addHoursToDate(now,-6)
      var TimeLimit = addHoursToDate(kordtime,2)
      let items;
      if (type == 'arrivals') {
        items = response.data.data.filter(function(item) {
          return (item.flight_status != 'landed') && (item.arrival.scheduled >  kordtime) && (item.arrival.scheduled < TimeLimit);
        });
      } else {
        items = response.data.data.filter(function(item) {
          return item.flight_status != 'landed' && !(item.flight_status == 'active' && item.departure.actual) && (Date.parse(item.departure.scheduled) > Date.parse(kordtime)) && (Date.parse(item.departure.scheduled) < Date.parse(TimeLimit))
        });
      }

      for (let i = 0; i < items.length; i++) {
        var item = items[i];
        //console.log(item);

        var airline = item.airline.icao;
        var time = '????';
        var terminal;
        var gate;
        var location = 'TBA';
        var timeString;
        var timezone;
        var remarks = item.flight_status;

        if (type == 'arrivals') {
          // ARRIVAL
          timeString =
            item.arrival.actual ||
            item.arrival.estimated ||
            item.arrival.scheduled;
          timezone = item.arrival.timezone;
          if (item.flight_status == 'cancelled') {
            terminal = 'XXX';
            gate = 'XXX';
          } else {
            terminal = item.arrival.terminal;
            gate = item.arrival.gate;
          }
          location = item.departure.airport;

          if (item.arrival.delay && item.flight_status == 'active') {
            remarks = 'Delayed ' + item.arrival.delay + 'm';
          }
        } else {
          // DEPARTURE
          timeString =
            item.departure.actual ||
            item.departure.estimated ||
            item.departure.scheduled;
          timezone = item.departure.timezone;
          if (item.flight_status == 'cancelled') {
            terminal = 'XXX';
            gate = 'XXX';
          } else {
            terminal = item.departure.terminal;
            gate = item.departure.gate;
          }
          location = item.arrival.airport;

          if (item.departure.delay && item.flight_status == 'scheduled') {
            remarks = 'Delayed ' + item.departure.delay + 'm';
          }
        }

        moment.tz(timezone);
        var d = moment(timeString.substr(0, 19)).tz(timezone, true);
        if (d) {
          time = d.format('hhmm');
        } else {
          time = '????';
        }

        var flight = item.flight.iata || item.flight.icao;

        var status = badFlightStatuses.includes(item.flight_status) ? 'B' : 'A';

        let data = {
          airline: airline,
          flight: flight,
          city: location,
          terminal: terminal,
          gate: gate,
          scheduled: time,
          timeString: timeString,
          status: status,
          remarks: remarks
        };

        results.push(data);
      }
      // console.log(results);
      return(results);
    })
    .catch(function (error) {
      console.log(error);
      return(results);
    });
}

function fetchFromLaminar(airport, type, userKey) {
  var axios = require('axios');

  let results = [];

  let config = {
    method: 'get',
    url: 'https://api.laminardata.aero/v1/aerodromes/' + airport + '/' + type + '?user_key=' + userKey
  };
  console.log(config.url);

  return axios(config)
    .then(function (response) {
      //console.log(JSON.stringify(response.data));

      for (let i = 0; i < response.data.features.length; i++) {
        var item = response.data.features[i];

        var airline = item.properties.airline;

        var time;
        if (type == 'arrivals') {
          if (item.properties.arrival.runwayTime) {
            var timeString =
              item.properties.arrival.runwayTime.actual ||
              item.properties.arrival.runwayTime.estimated;

            var d = moment(timeString);
            if (d) {
              time = d.format('hhmm');
            } else {
              time = '????';
            }
          } else {
            time = '????'
          }
        } else {
          if (item.properties.arrival.runwayTime) {
            var timeString =
              item.properties.departure.runwayTime.actual ||
              item.properties.departure.runwayTime.estimate ||
              item.properties.departure.runwayTime.initial;

            var d = moment(timeString);
            if (d) {
              time = d.format('hhmm');
            } else {
              time = '????';
            }
          } else {
            time = '????'
          }
        }

        var flight = item.properties.iataFlightNumber || item.properties.callsign;

        var gate = 'TBA'; // Need to find a data source that includes this

        var departure;
        if (item.properties.departure.aerodrome) {
          departure = item.properties.departure.aerodrome.actual ||
                      item.properties.departure.aerodrome.scheduled ||
                      item.properties.departure.aerodrome.initial;
        } else {
          departure = 'TBA';
        }

        var arrival;
        if (item.properties.arrival.aerodrome) {
          arrival = item.properties.arrival.aerodrome.actual ||
                    item.properties.arrival.aerodrome.scheduled ||
                    item.properties.arrival.aerodrome.initial;
        } else {
          arrival = 'TBA';
        }

        var status = item.properties.flightStatus == 'AIRBORNE' ? 'A' : 'B';

        var remarks = item.properties.flightStatus;

        let data = {
          airline: airline,
          flight: flight,
          city: type == 'arrivals' ? departure : arrival,
          gate: gate,
          scheduled: time,
          status: status,
          remarks: remarks
        };

        results.push(data);
      }
      // console.log(results);
      return(results);
    })
    .catch(function (error) {
      console.log(error);
      return(results);
    });
}

// ========================================================================
// API

app.use('/api/airport/:airport/arrivals', async (req, res) => {
  let r = {
    data: []
  };

  r.data = await fetchFromAviationStack(req.params.airport, 'arrivals', aviationStackAccessKey);
  res.json(r);
});

app.use('/api/airport/:airport/departures', async (req, res) => {
  let r = {
    data: []
  };

  r.data = await fetchFromAviationStack(req.params.airport, 'departures', aviationStackAccessKey);
  res.json(r);
});

// ========================================================================
// VIEWS
app.set('view engine', 'pug');

app.get('/airports/:airport/arrivals', function (req, res) {
  const airframesData = {
    airport: req.params.airport
  };
  res.render('arrivals', {
    title: 'Airport Arrivals to ' + req.params.airport,
    airport: req.params.airport,
    airframesData: airframesData
  });
})

app.get('/airports/:airport/departures', function (req, res) {
  const airframesData = {
    airport: req.params.airport
  };
  res.render('departures', {
    title: 'Airport Departures from ' + req.params.airport,
    airport: req.params.airport,
    airframesData: airframesData
  });
})

app.get('/', function (req, res) {
  res.render('index', { title: 'Airport Board' });
});

// ========================================================================
// STATIC FILES
app.use('/', express.static('public'));

// ========================================================================
// WEB SERVER
app.listen(port);
console.log('Airport Solari Board started on port ' + port);
