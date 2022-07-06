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

# to keep chromedriver up to date(r)
# pip install webdriver-manager
# pip install selenium
# from selenium import webdriver
# from webdriver_manager.chrome import ChromeDriverManager


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

        # hmm painful to run this in the background.
        # old chromedriver?  run below, then: cd ~/bin; ln -s /home/musick/.wdm/drivers/chromedriver/linux64/100.0.4896.60/chromedriver
        # old chromedriver?  run below, then: cd ~/bin; rm chromedriver; ln -s /home/musick/.wdm/drivers/chromedriver/linux64/102.0.5005.61/chromedriver
        # driver = webdriver.Chrome(ChromeDriverManager().install())
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
def runTest( testName, override, noBuild = True, optimized = False ):
    logging.info( "" )

    # cmd = "flutter drive --driver=test_driver/integration_test.dart --target=integration_test/" + testName + " -d web-server"
    cmd = "flutter drive -d chrome --driver=test_driver/integration_test.dart --target=integration_test/" + testName

    if optimized :
        cmd = cmd + " --release"

    if override :
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
def runTests( override = False ):

    #os.chdir( "./" )

    resultsSum = ""

    # Nightly, only area ---------
    if override:
        tsum = runTest( "launch_test.dart", override, False, False )
        resultsSum  += tsum

        tsum = runTest( "home_test.dart", override, False, False )
        resultsSum  += tsum

    # Focus area ------------------

    # Always clean dynamo summaries and 'ingested' tags first.
    #cmd = "npm run cleanFlutter --prefix ../webServer"
    #npmRun = runCmd( cmd, [] )
    #logging.info( npmRun )
    tsum = runTest( "project_test.dart", override, False, False )
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
    elif( cmd == "overrideAllOn" ) : summary = runTests( override = True )
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

