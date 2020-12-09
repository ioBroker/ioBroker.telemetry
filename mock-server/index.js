var express = require('express')
  , app = express.createServer();

app.use(express.bodyParser());

app.post('/', function(request, response){
  console.log(request.body);      // your JSON
  response.send(request.body);    // echo the result back
});

app.listen(4000);