#!/usr/bin/env python

import sys
import os
import platform
import logging

import json    #test data import
import boto3   #test data import

from os import path

from threading import Thread
from subprocess import call, check_output, Popen, PIPE

from packaging import version

from samInstance import samInstance
import awsCECommon

# XXX create, delete awsConfig for codeEquity, when create/delete CE resources
# XXX later, something like https://aws.amazon.com/blogs/architecture/new-application-integration-with-aws-cloud-map-for-service-discovery/
# XXX Add jq to setup script.  (sudo apt install jq)

def updateHost():
    logging.info("Trying to update localhost")
    call("sudo apt-get update", shell=True)

# NOTE: thanks to pyenv,
#   1: do not run pips as sudo - else does not update local python version (!!!)
#   2: run all, even if global python is 'updated'.  Local python needs all of this
def InstallAWSPermissions():
    logging.info ("Updating aws requirements, permissions")
    updateHost()
    configLoc = os.environ['HOME']+"/.aws"
    
    # python3, boto3
    # for aws synch
    call( "sudo apt-get install -y ntp", shell=True )
    # Get pip?
    if( call("command -v pip", shell=True) != 0 and call("command -v pip3", shell=True) != 0 ) : 
        call("sudo curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py", shell=True)
        call("python get-pip.py", shell=True )
    
    call("pip install --upgrade pip", shell=True )
    call("pip install paramiko --upgrade", shell=True )
    call("pip install certifi --upgrade", shell=True )
    call("pip install awscli --upgrade", shell=True )
    call("pip install packaging --upgrade", shell=True )
    # urllib3 issues, this is dangerous
    # sudo pip install awscli --upgrade --ignore-installed urllib3
    # call("pip install urllib3 --upgrade", shell=True )
    call("pip install boto3 --upgrade", shell=True )

    call( "sudo rm -rf " + configLoc, shell=True )
    call( "mkdir -p " + configLoc, shell=True )
    call( "cp "+awsCECommon.ceAuthPath+"config " + configLoc+"/config", shell=True) 
    call( "cp "+awsCECommon.ceAuthPath+"credentials " + configLoc+"/credentials", shell=True) 

    

def validateConfiguration():
    logging.info("Validating local environment")
    goodConfig = True
    if( platform.system() != 'Linux' ) :
        logging.warning( "You do not appear to be running on a Linux platform.  This code has not be tested on other platforms." )
        goodConfig = False
    if( "Ubuntu" not in platform.version() ) :
        logging.warning( "You do not appear to be running an Ubuntu distribution.  This code has not be tested on other distributions." )
        goodConfig = False
    if( call("command -v sam", shell=True) != 0 ) :
        logging.warning( "AWS SAM CLI does not appear to be installed" )
        goodConfig = False
    if( call("command -v npm", shell=True) != 0 ) :
        logging.warning( "npm does not appear to be installed" )
        goodConfig = False
    if( call("command -v nodejs", shell=True) != 0 ) :
        logging.warning( "nodejs does not appear to be installed" )
        goodConfig = False
    else :
        nver = check_output(["nodejs", "--version"]).decode('utf-8')
        if( version.parse( nver ) < version.parse(awsCECommon.ceNodeJSVersion) ) :
            logging.warning( "Please update your nodejs version" )
            goodConfig = False
        
    return goodConfig



def getCFStacks( sam ) :
    sam.getStacks()


# Get size of table: aws dynamodb describe-table --table-name Libraries
# https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Backup.Tutorial.html


def splitAndLoad( sam, fileName, tableName ) :
    d={}
    with open( fileName ) as f:
        d = json.load(f)

    client = boto3.client('dynamodb')

    for x in sam.batchRip( d[tableName], 25 ):
        subbatch_dict = {tableName: x}
        response = client.batch_write_item(RequestItems=subbatch_dict)

    
# CAREFUL (!!!) this writes to dynamo
def createTestDDBEntries( sam ) :
    # cmd = "aws dynamodb batch-write-item --request-items file://testData/testDataOwnerships.json"
    # splitAndLoad(sam, "testData/testDataPeople.json", "People" )
    # absolute path, or relative from ops.  above relative path is incorrect.
    # splitAndLoad(sam, "../webServer/tests/testData/baselineData/dynamoCEPEQRaw.json", "CEPEQRaw" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEGithub_latest.json", "CEHostUser" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCELinkage_latest.json", "CELinkage" )
    splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEPeople_latest.json", "CEPeople" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEPEQActions_latest.json", "CEPEQActions" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEPEQRaw_latest.json", "CEPEQRaw" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEPEQs_latest.json", "CEPEQs" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEPEQSummary_latest.json", "CEPEQSummary" )
    # splitAndLoad(sam, "../../webServer/tests/testData/tmp/dynamoCEProjects_latest.json", "CEProjects" )

    
def createConfigFiles( sam, Xs = False ):
    poolID   = "us-east-1_XXXXXXXXX"
    clientID = "XXXXXXXXXXXXXXXXXXXXXXXXXXX"
    apiBase  = "https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/XXXX"

    if( not Xs ) :
        poolID   = sam.getStackOutput( awsCECommon.samCodeEquityAppStackName, "UserPoolID" )
        clientID = sam.getStackOutput( awsCECommon.samCodeEquityAppStackName, "UserPoolClientId" )
        apiBase  = sam.getStackOutput( awsCECommon.samCodeEquityAppStackName, "CodeEquityApiExecution" )

    configData = "{\n"
    configData += "    \"CognitoUserPool\": {\n"
    configData += "        \"Default\": {\n"
    configData += "            \"PoolId\": \"" + poolID + "\",\n"
    configData += "            \"AppClientId\": \"" + clientID + "\",\n"
    configData += "            \"AppClientSecret\": \"\",\n"
    configData += "            \"Region\": \"" + awsCECommon.ceRegion + "\"\n"
    configData += "        }\n"
    configData += "    }\n"
    configData += "}\n\n"
    
    filenameConfig = awsCECommon.ceAppConfigPath + awsCECommon.ceAppConfigName
    with open(filenameConfig, "w+") as f:
        f.write(configData)

    filenamePath = awsCECommon.ceAppAssetPath + "api_base_path.txt"
    with open(filenamePath, "w+") as f:
        f.write(apiBase)

    # push to S3 bucket to allow deployed apps to reach new backend Cognito
    # unfortunately, flutter_cognito plugin bakes this info in at deploy time - no way to update
    """
    if( not Xs ) :
        s3Name = "s3://" + awsCECommon.samStaticWebBucket + "/"
        cmd1 = "aws s3 cp " + filenameConfig + " " + s3Name + filenameConfig
        cmd2 = "aws s3 cp " + filenamePath   + " " + s3Name + filenamePath
        if( call(cmd1,  shell=True) != 0 ) : logging.warning( "Failed to create config file on S3" )
        if( call(cmd2,  shell=True) != 0 ) : logging.warning( "Failed to create apiBase file on S3" )
    """

    # instead, write configData to files as well - xplatform.  Could get from awsconfig, but that is Android-specific
    filenameConfig = awsCECommon.ceAppAssetPath + awsCECommon.ceAppConfigName
    with open(filenameConfig, "w+") as f:
        f.write(configData)
    
    
    
def anonymizeConfigFiles( sam ):
    createConfigFiles( sam, Xs = True )


        
def makeCEResources( sam ) :
    #Make a SAM deployment bucket, create another S3 bucket for static pages, then create the infrastructure
    sam.makeDeployBucket( awsCECommon.samDeployBucket )

    sam.createS3Bucket( stackName    = awsCECommon.samStaticWebStackName, 
                        template     = awsCECommon.samStaticWebYAML, 
                        bucketName   = awsCECommon.samStaticWebBucket, 
                        deployBucket = awsCECommon.samDeployBucket )

    sam.createServerlessInfrastructure( stackName    = awsCECommon.samCodeEquityAppStackName, 
                                        template     = awsCECommon.samInfrastructureYAML,
                                        webBucket    = awsCECommon.samStaticWebBucket, 
                                        deployBucket = awsCECommon.samDeployBucket )

    # XXX Until we have dynamic resource configuration, create local CE config files
    createConfigFiles( sam )
    createTestAccounts( sam )
    # XXX    
    #createTestDDBEntries( sam )

    
def createTestAccounts( sam ) :
    #Create and confirm all _ce_tester accounts
    poolID   = sam.getStackOutput( awsCECommon.samCodeEquityAppStackName, "UserPoolID" )
    cmdBase = "aws cognito-idp admin-create-user --message-action SUPPRESS --user-pool-id " + poolID + " --username "
    pwdBase = "aws cognito-idp admin-set-user-password --user-pool-id " + poolID + " --username "
    unameBase = "_ce_tester_1664"

    # Test login switchboard, does very little work
    tbase  = cmdBase + unameBase + " --user-attributes Name=email,Value=success@simulator.amazonses.com Name=email_verified,Value=true"
    tpBase = pwdBase + unameBase + " --password passWD123 --permanent"
    if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
    if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    # Actual test accounts that do all the work
    username = ""
    for i in range(10):
        username = unameBase + "_" + str(i)
        tbase  = cmdBase + username + " --user-attributes Name=email,Value=success@simulator.amazonses.com Name=email_verified,Value=true"
        tpBase = pwdBase + username + " --password passWD123 --permanent"
        if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
        if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    # Add aspell and dbase accounts for by-hand testing
    tbase  = cmdBase + "dbase --user-attributes Name=email,Value=success@simulator.amazonses.com Name=email_verified,Value=true"
    tpBase = pwdBase + "dbase --password passWD123 --permanent"
    if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
    if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    tbase  = cmdBase + "aspell --user-attributes Name=email,Value=success@simulator.amazonses.com Name=email_verified,Value=true"
    tpBase = pwdBase + "aspell --password passWD123 --permanent"
    if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
    if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    # Finally, add ceServer, tester accounts.
    ceConfigData = ""
    with open(awsCECommon.ceServerConfig, "r") as read_file:
        ceConfigData = json.load(read_file)
        
    server1 = ceConfigData['ceServer']
    tbase  = cmdBase + server1['Username'] + " --user-attributes Name=email,Value=" + server1['Email'] + " Name=email_verified,Value=true"
    tpBase = pwdBase + server1['Username'] + " --password " + server1['Password'] + " --permanent"
    if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
    if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    tester1 = ceConfigData['tester1']
    tbase  = cmdBase + tester1['Username'] + " --user-attributes Name=email,Value=" + tester1['Email'] + " Name=email_verified,Value=true"
    tpBase = pwdBase + tester1['Username'] + " --password " + tester1['Password'] + " --permanent"
    if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
    if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    tester2 = ceConfigData['tester2']
    tbase  = cmdBase + tester2['Username'] + " --user-attributes Name=email,Value=" + tester2['Email'] + " Name=email_verified,Value=true"
    tpBase = pwdBase + tester2['Username'] + " --password " + tester2['Password'] + " --permanent"
    if( call(tbase,  shell=True) != 0 ) : logging.warning( "Failed to create tester " )
    if( call(tpBase, shell=True) != 0 ) : logging.warning( "Failed set password " )

    # Create corresponding baseline entries in CE tables.
    cmd = "aws dynamodb batch-write-item --request-items file://baselineData/cePeople.json"
    if( call(cmd, shell=True) != 0 ) : logging.warning( "Failed to write baseline data: CEPeople " )
    


def help() :
    logging.info( "Available commands:" )
    logging.info( "  - makeCEResources:       create all required CodeEquity resources on AWS." )
    logging.info( "  - deleteCEResources:     remove all CodeEquity resources on AWS." )
    logging.info( "  - getCFStacks:           list your AWS CloudFormation stacks." )
    logging.info( "  - getStackOutputs:       display the outputs of CodeEquity's AWS CloudFormation stacks." )
    logging.info( "  - validateConfiguration: Will assert if your dev environment doesn't look suitable." )
    logging.info( "  - createTestDDBEntries:  Adds some test data to AWS DynamoDB tables")
    logging.info( "  - createTestAccounts:    Adds _ce_tester accounts and signup data for integration testing.")
    logging.info( "  - help:                  list available commands." )
    logging.info( "" )
    logging.info( "Pre-experimental commands:" )
    logging.info( "  - InstallAWSPermissions: Attempts to create a valid dev environment.  Best used as a set of hints for now." )
    logging.info( "" )
    logging.info( "Rebuilding?" )
    logging.info( "Remember to save any data you want to keep.  Then.." )
    logging.info( "python createCE.py getStackOutputs >& oldStack.txt" )
    logging.info( "python createCE.py deleteCEResources" )
    logging.info( "python createCE.py makeCEResources" )


    

# XXX remove deployment bucket? option to keep buckets around, so names not lost?
def deleteCEResources( sam ) :
    logging.info("")
    logging.info("Remove CodeEquity app stack")
    sam.removeStackResources( awsCECommon.samCodeEquityAppStackName )
    logging.info("")
    logging.info("Remove S3 stack")
    sam.removeStackResources( awsCECommon.samStaticWebStackName )

    # XXX Until we have dynamic resource configuration, delete local CE config files
    anonymizeConfigFiles( sam )
    

def getStackOutputs( sam ) :
    sam.describeStack( awsCECommon.samCodeEquityAppStackName )
    sam.describeStack( awsCECommon.samStaticWebStackName )


    
def main( cmd ):
    #print locals()
    #print globals()
    logging.basicConfig(format='%(asctime)s %(levelname)s: %(message)s',datefmt='%m/%d/%Y %I:%M:%S %p', 
                        handlers= [logging.FileHandler(filename='codeEquity.log'),logging.StreamHandler()],
                        level=logging.INFO)

    assert( validateConfiguration() )

    sam = samInstance( region = awsCECommon.ceRegion )

    logging.info("")
    logging.info("TODO:")
    logging.info("Run stress tests")
    logging.info("Get insights AWS")
    logging.info( "END TODO")
    logging.info("")
    
    if( cmd == "validateConfiguration") :
        logging.info( "finished...exiting" )
        return 

    if( cmd == "help" or cmd == "") :
        help()
        return

    thread = Thread( target=globals()[cmd]( sam ) )
    thread.start()
    thread.join()
    logging.info( "thread finished...exiting" )

    
if __name__ == "__main__":
    awsCECommon.init()   
    
    # print locals()   
    # print sys.argv
    if len(sys.argv) < 2:
        main("")
        #raise SyntaxError("Insufficient arguments.")
    else:
        main(sys.argv[1])

