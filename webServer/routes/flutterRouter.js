import express from 'express';

import * as utils from '../utils/ceUtils.js';
import * as auth  from "../auth/gh/ghAuth.js";

var router = express.Router();

// XXX  proof of concept
const OWNER = "codeEquity";
const REPO  = "testbed";

const CARD_ID  = 39929800;  // Egg
const COL_ID_1 = 9390449;   // do stuff
const COL_ID_2 = 9572961    // done stuff

// get from flutter app
router.post('/:location?', async function (req, res) {


    console.log( "CALLING FLUTTER ROUTER???????" );
    
    var installClient = await auth.getInstallationClient( OWNER, REPO );


    console.log( req.body );
    // console.log( req.headers );

    var action = "";
    if( req.body['Endpoint'] == "assocGH" ) {

	// Authenticate uname, pword
	// call lambda.......
	
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

    /*
      return {
      weather: {
         location: location || 'londonon',
         temperature: `${currentSeconds / 2}\u2103`,
         weatherDescription: currentSeconds % 2 == 0 ? 'partly snowy' : 'haily'
      }}
     */
    
});


export {router};
