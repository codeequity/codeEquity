#!/usr/bin/env python

import sys
import os
import platform
import logging
import time

from os import path
from subprocess import call, check_output, Popen, PIPE, STDOUT
import shlex

#from threading import Thread
#import concurrent.futures


def validateConfiguration():
    logging.info("Validating local environment")
    goodConfig = True
    if( platform.system() != 'Linux' ) :
        logging.warning( "You do not appear to be running on a Linux platform.  This code has not be tested on other platforms." )
        goodConfig = False
    if( "Ubuntu" not in platform.version() ) :
        logging.warning( "You do not appear to be running an Ubuntu distribution.  This code has not be tested on other distributions." )
        goodConfig = False
    if( call("command -v flutter", shell=True) != 0 ) :
        logging.warning( "Flutter does not appear to be installed" )
        goodConfig = False
        
    return goodConfig


def verifyEmulator():
    logging.info( "Ensure emulator (chromedriver) is running" )
    # flutter devices always shows chrome web-javascript, no matter if chromedriver is actually running.
    goodConfig = True
    if( call("ps -efl | grep chromedriver | grep -v grep", shell=True) != 0 ) :
        call( "~/chromeDriver/chromedriver --port=4444&", shell=True )
        # XXX Can we detect when this is ready?
        # XXX Can auto-wipe user data?
        time.sleep(10)
        if( call("ps -efl | grep chromedriver | grep -v grep", shell=True) != 0 ) :
            goodConfig = False

            
    return goodConfig


def clean( output, filterExp ) :
    resultsSum = ""
    if output:
        keep = True
        for fe in filterExp :
            if fe in output :
                keep = False
                break
        if keep :
            if( "ceFlutter Test Group" in output or
                "tests passed!" in output        or
                "tests failed!" in output           ) :
                resultsSum = output
            print( output.strip() )
    return resultsSum
    


def runCmd( cmd, filterExp ):
    process = Popen(shlex.split(cmd), stderr=STDOUT, stdout=PIPE, encoding='utf8')
    resultsSum = ""
    while True:
        output = process.stdout.readline()
        if output == '' and process.poll() is not None:
            break
        resultsSum += clean( output, filterExp )

    process.poll()
    return resultsSum


# NOTE using --no-build causes consequtive runs of flutter driver to connect to the same app, same state(!)
def runTest( testName, noBuild = True ):
    logging.info( "" )

    # cmd = "flutter drive --driver=test_driver/integration_test.dart --target=integration_test/" + testName + " -d web-server"
    cmd = "flutter drive --driver=test_driver/integration_test.dart --target=integration_test/" + testName
    grepFilter = ['async/zone.dart','I/flutter', 'asynchronous gap', 'api/src/backend/', 'zone_specification', 'waitFor message is taking' ]

    # poll for realtime stdout
    tmpSum = runCmd( cmd, grepFilter )
    
    return tmpSum


"""
Common failure modes: 

"""
def runTests():

    #os.chdir( "./" )

    resultsSum = ""

    tsum = runTest( "login_pass_test.dart", False )
    resultsSum  += tsum

    #tsum = runTest( "login_fail.dart", False )
    #resultsSum  += tsum

    #tsum = runTest( "content.dart", False )
    #resultsSum  += tsum

    #tsum = runTest( "sharing.dart", False )
    #resultsSum  += tsum

    logging.info( "" );
    logging.info( "" );
    logging.info( "================================" );
    logging.info( "Summary:" );
    logging.info( "================================" );
    logging.info( resultsSum );

    os.chdir( "../" )


def main( cmd ):
    #print locals()
    #print globals()
    logging.basicConfig(format='%(asctime)s %(levelname)s: %(message)s',datefmt='%m/%d/%Y %I:%M:%S %p', 
                        handlers= [logging.FileHandler(filename='ceFlutterTests.log'),logging.StreamHandler()],
                        level=logging.INFO)

    assert( validateConfiguration() )
    assert( verifyEmulator() )

    if( cmd == "" ) : runTests()
    else :
        thread = Thread( target=globals()[cmd]( ) )
        thread.start()
        thread.join()
        logging.info( "thread finished...exiting" )

    
    
if __name__ == "__main__":
    # print locals()   
    # print sys.argv
    if len(sys.argv) < 2:
        main("")
        #raise SyntaxError("Insufficient arguments.")
    else:
        main(sys.argv[1])

