var express = require('express');
var router  = express.Router();
var utils   = require('../utils');
const auth = require( "../auth");

const OWNER = "codeEquity";
const REPO  = "testbed";

const CARD_ID  = 39929800;  // Egg
const COL_ID_1 = 9390449;   // do stuff
const COL_ID_2 = 9572961    // done stuff

// get from flutter app
router.post('/:location?', async function (req, res) {


    var installClient = await auth.getInstallationClient( OWNER, REPO );


    console.log( req.body );
    // console.log( req.headers );

    var action = "";
    if( req.body['Endpoint'] == "Left" ) {
	action = "Baba";

	installClient.projects.moveCard({
	    card_id: CARD_ID,
	    position: "top",
	    column_id: COL_ID_1
	});
	
    }
    else if( req.body['Endpoint'] == "Right" ) {
	action = "Yaga"; 

	installClient.projects.moveCard({
	    card_id: CARD_ID,
	    position: "top",
	    column_id: COL_ID_2
	});

    }
    else {
	action = "Uh oh";
    }
    return res
	.status(200)
	.json({ action: action
	      });
    
});

module.exports = router;
