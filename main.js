var idMember;

Date.prototype.toString = function () { 
    return this.getUTCFullYear() +"-"+(((this.getUTCMonth()+1) < 10)?"0":"") + (this.getUTCMonth()+1) +"-"+ ((this.getUTCDate() < 10)?"0":"") + this.getUTCDate();
}

var human_format = function(milliseconds) {
  var minutes = ~~(milliseconds / 1000 / 60);  // whole number division
  var m = minutes % 60;
  var h = (minutes - m) / 60;
  return ((h<10)?"0":"") + h + ":" + ((m<10)?"0":"") + m;
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

var authenticationSuccess = function() {
  Trello.get('/tokens/' + Trello.token(), {}, function(data) {
    idMember = data.idMember;
    var now = new Date();
    var yesterday = new Date(now - 1000*3600*24*1);
    var params = {
      limit: 1000,
      memberCreator: 'false',
      member_fields: 'fullName',
      since: yesterday.toString(),
      fields: 'type,date,data',
      filter: 'addMemberToCard,removeMemberFromCard'
    };
    Trello.get('/members/' + idMember + '/actions', params, function(data) {
      var cards = [];
      var incomplete_actions = {};
      for (var i=0; i<data.length; i++) {
        var matched = false;
        for (idAction in incomplete_actions) {
          if ((data[i]['type'] != incomplete_actions[idAction]['type']) && (data[i]['data']['card']['id'] == incomplete_actions[idAction]['data']['card']['id'])) {
            matched = true;
            var add_time = new Date(data[i]['date']);
            var remove_time = new Date(incomplete_actions[idAction]['date']);
            cards.push({
              duration: remove_time - add_time, // in milliseconds
              name: data[i]['data']['card']['name'],
              data: data[i]['data']['card']
            });
            delete incomplete_actions[idAction];
          }
        }
        if (!matched) {
          incomplete_actions[data[i]['id']] = data[i];
        }
      }
      // show
      var report__cards = "";
      var report__unfinished = "";
      for (idAction in incomplete_actions) {
        if (incomplete_actions[idAction]['type'] == 'addMemberToCard') {
          report__unfinished += 'Started working on ' + incomplete_actions[idAction]['data']['card']['name'] + '\n';
        }
        else {
          report__unfinished += 'Finished with ' + incomplete_actions[idAction]['data']['card']['name'] + '\n';
        }
      }
      var total_duration = 0;
      for (var i=cards.length-1; i>=0; i--) {
        report__cards += '[' + human_format(cards[i].duration) + '] ' + cards[i].name + '\n';
        total_duration += cards[i].duration;
      }

      document.getElementById('header').setAttribute('style', 'display: none;');
      document.getElementById('report__cards').innerHTML = report__cards;
      document.getElementById('report__unfinished').innerHTML = report__unfinished;
      document.getElementById('report__total').innerHTML = hours_minutes(total_duration);
    });
  });
};

var authenticationFailure = function() { console.log("Failed authentication"); };

var authorize = function() {
  Trello.authorize({
    type: "popup",
    name: "Trello Activity Report",
    scope: {
      read: true },
    expiration: "never",
    success: authenticationSuccess,
    error: authenticationFailure
  });
}
