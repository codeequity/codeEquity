#!/usr/bin/env python

import sys
import os
import signal
import platform
import logging
import time

from os import path
from subprocess import call, check_output, Popen, PIPE, STDOUT
import shlex

from threading import Thread
#import concurrent.futures


# python testCEFlutter.py overrideAllOn
# python testCEFlutter.py


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

def closeListeners():
    # chromeDriver
    cmd = "ps -efl | grep chromedriver | grep -v grep"
    val = check_output( cmd, shell=True).decode('utf-8')
    if( len(val) > 5 ) :
        pid = val.split()
        print( "Killing chromedriver at " + pid[3] )
        os.kill( int(pid[3]), signal.SIGTERM )

def updateFlutter( cmd ):
    retVal = True
    if( cmd != "overrideAllOn" ) :
        return retVal
    
    logging.info( "Updating flutter" )
    if( call("flutter upgrade", shell=True) != 0 ) :
        logging.info( "Updating flutter failed." )
        retVal = False

    logging.info( "Updating flutter packages" )
    if( call("flutter pub get", shell=True) != 0 ) :
        logging.info( "Updating flutter packages failed." )
        retVal = False
            
    return retVal


def verifyEmulator():
    logging.info( "Ensure emulator (chromedriver) is running" )
    # flutter devices always shows chrome web-javascript, no matter if chromedriver is actually running.
    goodConfig = True
    if( call("ps -efl | grep chromedriver | grep -v grep", shell=True) != 0 ) :

        # Check if chromedriver needs updating.  Sleep to make sure we don't link before renaming.
        cdpv = "set `chromedriver --version`; set `echo $2 | cut -c1-3`; cd=$1;"
        gcpv = "set `google-chrome --version`; set `echo $3 | cut -c1-3`; gc=$1;"
        if( call( cdpv + gcpv + " [ $cd -eq $gc ]", shell=True) != 0 ) :
            print( "Chrome Driver is out of date.  Attempting to update. ")
            if( call( "rm chromedriver", shell=True) != 0 ) : print( "Error." )
            if( call( "rm -rf chromedriverLin", shell=True) != 0 ) : print( "Error." )
            if( call( "npx @puppeteer/browsers install chromedriver@stable", shell=True) != 0 ) : print( "Error." )
            if( call( "mv chromedriver chromedriverLin", shell=True) != 0 ) : print( "Error." )
            time.sleep(5)
            if( call( "ln -s */*/*/chromedriver", shell=True) != 0 ) : print( "Error." )
          
        call( "chromedriver --port=4444&", shell=True )
        
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
                "Subtest:" in output             or
                "tests passed" in output         or
                "[E]" in output                  or
                "Actual:" in output              or
                "Failure in method" in output    or
                "Test failed" in output           ) :
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
# Hmm.  Running in release mode does not work well.  Basic entering text fails..
def runTest( testName, override, withDetail = False, noBuild = True, optimized = False ):
    logging.info( "" )

    # timeout none does not help.  https://github.com/flutter/flutter/issues/105913
    # trying @Timeout(Duration(minutes: 25))
    # Test by hand, i.e. python testCEFlutter.py
    # cmd = "flutter drive -d chrome --driver=test_driver/integration_test.dart --target=integration_test/" + testName
    # Test by cronjob.. why?  this will drive 2 windows in by-hand case
    # browser dim controls the window being driven by tester.  The height does not match physical screen height, but is stable.
    cmd = "flutter drive -d chrome --browser-dimension=1200,1050 --no-headless --driver=test_driver/integration_test.dart --target=integration_test/" + testName


    if optimized :
        cmd = cmd + " --release"

    # withDetail is only relevant to project_test
    if( override and withDetail ) :
        cmd = cmd + " --dart-define overrideWithDetail=True"
    elif( override and not withDetail ) :
        cmd = cmd + " --dart-define override=True"

    grepFilter = ['async/zone.dart','I/flutter', 'asynchronous gap', 'api/src/backend/', 'zone_specification', 'waitFor message is taking' ]

    # poll for realtime stdout
    tmpSum  = "\n"
    tmpSum += runCmd( cmd, grepFilter )

    return tmpSum


"""
Common failure modes: 
1. Chromedriver is out of date.  
   Uncomment selenium and driver-related lines, rerun, relink, good to go.  Yes, this could be automated.

"""
def runTests( override = False, projectDetail = False ):

    #os.chdir( "./" )

    resultsSum = ""

    # Nightly, only area ---------
    if( override and not projectDetail ):
        tsum = runTest( "launch_test.dart", override, False, False, False )
        resultsSum  += tsum

        tsum = runTest( "home_test.dart", override, False, False, False )
        resultsSum  += tsum

        # Always clean dynamo summaries and 'ingested' tags first for full tests
        cmd = "npm run cleanFlutter --prefix ../webServer"
        npmRun = runCmd( cmd, [] )
        logging.info( npmRun )

        tsum = runTest( "project_test.dart", override, False, False, False )
    elif( override and projectDetail ):
        tsum = runTest( "project_test.dart", override, True, False, False )
                
    # Focus area ------------------
    
    tsum = runTest( "equity_test.dart", override, False, False, False )    
    # tsum = runTest( "project_test.dart", override, False, False, False )
    # tsum = runTest( "project_test.dart", override, True, False, False )
    resultsSum  += tsum


    

    # Somehow, combination of new teardown for integration_test and popen is
    # defeating attempts to leave summary below all error messages.
    logger = logging.getLogger()
    logger.handlers[0].flush()
    sys.stderr.flush()

    # Force it.  Keep the flush above to catch teardown errors
    logging.info( "" )
    logging.info( "" )
    logging.info( "================================" )
    logging.info( "Summary:" )
    logging.info( "================================" )
    logging.info( resultsSum )
    logging.info( "================================" )

    summary  = "\n"
    summary += "\n"
    summary += "================================\n"
    summary += "Summary:\n"
    summary += "================================\n"
    summary += resultsSum + "\n"
    summary += "================================\n"
    
    os.chdir( "../" )
    return summary


def main( cmd ):
    #print locals()
    #print globals()
    logging.basicConfig(format='%(asctime)s %(levelname)s: %(message)s',datefmt='%m/%d/%Y %I:%M:%S %p', 
                        handlers= [logging.FileHandler(filename='ceFlutterTests.log'),logging.StreamHandler()],
                        level=logging.INFO)

    assert( validateConfiguration() )
    assert( updateFlutter( cmd ) )
    assert( verifyEmulator() )

    summary = ""
    if( cmd == "" ) : summary = runTests()
    elif( cmd == "overrideNoDetail" ) : summary = runTests( override = True, projectDetail = False )
    elif( cmd == "overrideDetailOnly" ) : summary = runTests( override = True, projectDetail = True )
    else :
        thread = Thread( target=globals()[cmd]( ) )
        thread.start()
        thread.join()
        logging.info( "thread finished...exiting" )

    closeListeners()

    print( summary )
    
    
if __name__ == "__main__":
    # print locals()   
    # print sys.argv
    if len(sys.argv) < 2:
        main("")
        #raise SyntaxError("Insufficient arguments.")
    else:
        main(sys.argv[1])

