var _ = require('underscore');
var express = require('express');

var db = require('../helpers/db');
var isBadRequest = require('../helpers/request-checker');

var router = express.Router();
var questionsService = require('../helpers/question-service');
var passwordMaker = require('../helpers/password-maker');

function createGame(values) {
  var query = 'INSERT INTO games ("mode_id","active", "password") VALUES ($1, true, $2) RETURNING game_id, password';

  return db.query(query, values);
}

router.post('/', function(req, res) {
  var values = [
    req.body.mode_id
  ];

  if (isBadRequest(values)) {
    res.status(400).send("Bad Request");
    console.log('bad request');
    return;
  }

  var logError = function(error) {
    console.log(error);
    res.status(500).send(error);
  };

  passwordMaker.createPassword().then(function(result) {
    values.push(result);
    createGame(values).then(function(result) {
      var row = result.rows[0];

      console.log("Game #" + row.game_id + " successfully created");
      console.log("Password for game #" + row.game_id + " is " + values[1]);

      var musicPromise = db.query('SELECT music FROM modes WHERE mode_id = ' + values[0]);
      var questionsPromise = questionsService.createQuestions(values[0], 5);

      Promise.all([musicPromise, questionsPromise]).then(function(results) {
        var musicResult = results[0];
        var questionsResult = results[1];

        row.music = musicResult.rows[0].music;
        row.questions = _.sortBy(questionsResult, function(n) {
          return n.place_id;
        });
        questionsService.saveQuestions(row.game_id, result).then(function(result) {
          console.log("Questions for game #" + row.game_id + " successfully saved.");
        }, logError);

        res.status(201).send(row);
      }, logError);
    }, logError);
  }, logError);
});

router.get('/:id/questions', function(req, res) {
  questionsService.getQuestions(req.params.id).then(function(result) {
    var rows = _.sortBy(result.rows, function(n) {
      return n.place_id;
    });

    res.status(200).send(rows);
  }, function(error) {
    console.log(error);
    res.status(500).send(error);
  });
});

module.exports = router;
