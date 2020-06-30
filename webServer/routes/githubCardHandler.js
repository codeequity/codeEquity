var express = require('express');
var testAuth = require('../testAuth');

var router = express.Router();

// push to me from GH
router.post('/:location?', async function (req, res) {
    await testAuth.runTests();
    return res.json({
	status: 200,
    });
});


// get request, from app
router.get('/:location?', function (req, res, next) {
  res.json(getStubAppData(req.params.location));
});

function getStubAppData(location) {
  var currentSeconds = new Date().getSeconds();
  return {
    weather: {
      location: location || 'londonon',
      temperature: `${currentSeconds / 2}\u2103`,
      weatherDescription: currentSeconds % 2 == 0 ? 'partly snowy' : 'haily'
    }
  };
}

module.exports = router;
