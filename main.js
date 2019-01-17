var idMember;
var members = {};  // id => name
var boards = {};  // id => name
var state = {
  date_from: null,
  date_to: null,
  title: null
};

Date.prototype.toString = function () { 
    return this.getUTCFullYear() +"-"+(((this.getUTCMonth()+1) < 10)?"0":"") + (this.getUTCMonth()+1) +"-"+ ((this.getUTCDate() < 10)?"0":"") + this.getUTCDate();
}

var human_format = function(milliseconds) {
  var minutes = ~~(milliseconds / 1000 / 60);  // whole number division
  var m = minutes % 60;
  var h = (minutes - m) / 60;
  var days = ~~(h / 24)
  if (days === 0) {
    return ((h<10)?"0":"") + h + ":" + ((m<10)?"0":"") + m;
  } else {
    h = h - days * 24
    var result = `${days} `
    if (days === 1) {
      result += "day"
    } else {
      result += "days"
    }
    return `${result}, ` + ((h<10)?"0":"") + h + ":" + ((m<10)?"0":"") + m;
  }
}

var hours_minutes = function(milliseconds) {
  var minutes = ~~(milliseconds / 1000 / 60);  // whole number division
  var m = minutes % 60;
  var h = (minutes - m) / 60;
  if (h > 0) {
    if (m > 0) {
      return h + " hours " + m + " minutes";
    }
    else {
      return h + " hours";
    }
  }
  else {
    return m + " minutes";
  }
}

var authenticationSuccess = function(date_from, date_to, title) {
  Trello.get('/tokens/' + Trello.token(), {}, function(data) {
    idMember = data.idMember;
    load_activity(idMember, date_from, date_to, title);
  });
};

var authenticationFailure = function() { console.log("Failed authentication"); };

var load_report = function(date_from, date_to, title) {
  state.date_from = date_from
  state.date_to = date_to
  state.title = title
  Trello.authorize({
    type: "popup",
    name: "Trello Activity Report",
    scope: {
      read: true },
    expiration: "never",
    success: function(){return authenticationSuccess(date_from, date_to, title);},
    error: authenticationFailure
  });
}

var show_activity = function(element) {
  const idMember = element.getAttribute('data-id')
  load_activity(idMember, state.date_from, state.date_to, state.title);
}

var load_activity = function(idMember, date_from, date_to, title) {
  var params = {
    limit: 1000,
    memberCreator: 'false',
    member_fields: 'fullName',
    since: date_from.toString(),
    before: date_to.toString(),
    fields: 'type,date,data',
    filter: 'updateCard'
  };
  Trello.get('/members/' + idMember + '/actions', params, function(data) {
    var cards = [];
    var incomplete_actions = {};
    for (var i=data.length-1; i>=0; i--) {
      var matched = false;
      if (data[i].data.listBefore && data[i].data.listAfter) { // only care about moving cards between lists
        if (data[i].data.listBefore.name === 'In Progress') { // moving out of "In Progress" means: stopped working on it
          for (idAction in incomplete_actions) { // when did I start to work on it? Find a matching card.
            if (
              (data[i].data.card.id === incomplete_actions[idAction].data.card.id) // same card
              && (incomplete_actions[idAction].data.listAfter.name === 'In Progress') // moved to "In Progress" means: started to work on it
            ) {
              matched = true;
              var stopped_working = new Date(data[i]['date']);
              var started_working = new Date(incomplete_actions[idAction]['date']);
              cards.push({
                duration: stopped_working - started_working, // in milliseconds
                name: data[i]['data']['card']['name'],
                data: data[i]['data']['card']
              });
              delete incomplete_actions[idAction];
            }
          }
        }
        if (!matched) {
          incomplete_actions[data[i]['id']] = data[i];
        }

        // get the board, store it if it's a new board
        if (boards[data[i].data.board.id] === undefined) {
          boards[data[i].data.board.id] = data[i].data.board.name;
        }
      }
    }
    // show
    var report__cards = "";
    var report__unfinished = "";
    for (idAction in incomplete_actions) {
      if (incomplete_actions[idAction].data.listAfter.name == 'In Progress') {
        report__unfinished += 'Started working on ' + incomplete_actions[idAction]['data']['card']['name'] + '\n';
      }
      else if (incomplete_actions[idAction].data.listBefore.name == 'In Progress') {
        report__unfinished += 'Finished with ' + incomplete_actions[idAction]['data']['card']['name'] + '\n';
      }
    }
    var total_duration = 0;
    for (var i=cards.length-1; i>=0; i--) {
      report__cards += '[' + human_format(cards[i].duration) + '] ' + cards[i].name + '\n';
      total_duration += cards[i].duration;
    }

    document.getElementById('header').setAttribute('style', 'display: none;');
    document.getElementById('report').setAttribute('style', 'display: flex;');
    document.getElementById('title').innerHTML = title;
    document.getElementById('report__cards').innerHTML = report__cards;
    document.getElementById('report__unfinished').innerHTML = report__unfinished;
    document.getElementById('report__total').innerHTML = hours_minutes(total_duration);

    // show which activity it is
    if (members[idMember] !== undefined) {
      document.getElementById('title').innerHTML = members[idMember];
    }

    for (board_id in boards) {
      // get all members for this board
      Trello.get('/boards/' + board_id + '/members', {}, function(data) {
        for (var i=0; i<data.length; i++) {
          if (members[data[i].id] === undefined) {
            members[data[i].id] = data[i].fullName;
            document.getElementById('buttons').innerHTML += '<button onClick="show_activity(this)" data-id="' + data[i].id + '">' + data[i].fullName + '</button>'; 
          }
        }
      });
    }
  });
}

var load_yesterday_activity = function() {
  var now = new Date();
  var date_from = new Date(now - (((24 + now.getHours()) * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000 + now.getMilliseconds());
  var date_to = new Date(now - ((now.getHours() * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000 + now.getMilliseconds());
  load_report(date_from, date_to, 'Yesterday');
}

var load_this_week_activity = function() {
  var now = new Date();
  var date_from = new Date(now - ((((now.getDay() * 24 + now.getHours()) * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000 + now.getMilliseconds()));
  var date_to = new Date();
  load_report(date_from, date_to, 'This Week');
}

var load_this_month_activity = function() {
  var now = new Date();
  var date_from = new Date(now - (((((now.getDate() - 1) * 24 + now.getHours()) * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000 + now.getMilliseconds()));
  var date_to = new Date();
  load_report(date_from, date_to, 'This Month');
}
