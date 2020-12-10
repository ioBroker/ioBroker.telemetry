var express = require('express')
  , bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.json());

app.post('/', function(request, response){
  console.log(request.body);      // your JSON
  response.send(request.body);    // echo the result back
});

app.listen(4000);