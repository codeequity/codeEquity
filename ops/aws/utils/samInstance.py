#!/usr/bin/env python

import sys
import time
import os
import logging

from os import path
from subprocess import call, check_output, Popen, PIPE

import boto3
from botocore.exceptions import ClientError

# by hand examples
# aws cloudformation describe-stack-resource --stack-name codeEquityS3 --logical-resource-id CodeEquityBucket


# AWS Serverless Application Model, or SAM
class samInstance():

    def __init__(self, region='us-east-1' ) :
        self.region     = region
        self.cfStacks   = []
        self.cfResource = boto3.resource('cloudformation', region_name = self.region )
        self.cfClient   = boto3.client('cloudformation', region_name = self.region )
        self.s3Resource = boto3.resource('s3')
        
    def _refreshStacks( self, silent = False ):
        if( not silent ): logging.info("Get AWS Cloudformation stacks")

        del self.cfStacks[:]
        for stack in self.cfResource.stacks.all() :
            if( not silent ) : logging.info( stack.stack_name + " " + stack.stack_status + " " +  stack.last_updated_time.strftime("%m/%d/%Y -- %H:%M:%S") )
            self.cfStacks.append( stack )
        return self.cfStacks


    def _stackExists( self, stackName, silent = False ):
        exists = False

        for stack in self._refreshStacks( silent ) :
            if( stack.stack_name == stackName ):
                exists = True
                break
            
        return exists
    
    def _canCreateS3( self, bucketName ) :
        exists = True
        canCreate = False
        status_code = '200' 
        try:
            self.s3Resource.meta.client.head_bucket( Bucket=bucketName )
        except ClientError as e:
            status_code = e.response['Error']['Code']
            if status_code == '403':  # access denied
                exists = True
                canCreate = False
            if status_code == '404':  # does not exist
                exists = False
                canCreate = True
                    
        assert( not ( canCreate and exists ))
        return exists, canCreate, status_code

    
    def _runSAMTemplate( self, template, deployBucket, stackName ) :
        logging.info( "Running SAM template: " + template )

        # create the "Pack"aged string 
        templPack = template
        assert( len(templPack) > 5 )
        assert( templPack[-4:] == "yaml" )
        templPack = templPack[0:-5] + "Pack.yaml"
    
        if( not path.exists( template ) ) :
            logging.error( "Yaml template " + template + " does not exist." )
            return

        if( self._stackExists( stackName ) ):
            logging.warning( "Cloudformation stack " + stackName + " already exists.  No action taken." )
            return
    
        try: 
            cmd = "sam validate -t " + template
            logging.info( cmd )
            val = check_output(cmd, shell=True).decode('utf-8')    
            logging.info( val )
        except ClientError as e:
            logging.error( e )

        try: 
            cmd = "sam build -t " + template
            logging.info( cmd )
            val = check_output(cmd, shell=True).decode('utf-8')    
            logging.info( val )
        except ClientError as e:
            logging.error( e )

        try: 
            cmd  = "sam package --template-file " + template + " --output-template-file " + templPack
            cmd += " --s3-bucket " + deployBucket
            logging.info( cmd )
            val = check_output(cmd, shell=True).decode('utf-8')    
            logging.info( val )
        except ClientError as e:
            logging.error( e )

        try: 
            cmd =  "sam deploy --template-file " + templPack + " --region " + self.region
            cmd += " --capabilities CAPABILITY_IAM --stack-name " + stackName
            logging.info( cmd )
            logging.info( "This may take a few minutes...." )
            val = check_output(cmd, shell=True).decode('utf-8')    
            logging.info( val )
        except ClientError as e:
            logging.error( e )



    # Public facing
    
    #https://stackoverflow.com/questions/40941231/aws-cli-dynamo-db-validationexception-error
    def batchRip(self, iterable, n=1):
        l = len(iterable)
        for ndx in range(0, l, n):
            yield iterable[ndx:min(ndx + n, l)]
    
    def getStacks( self ) :
        return self._refreshStacks()
        
    def makeDeployBucket( self, bucketName ) :
        logging.info("Making deploy bucket " +  bucketName )
    
        exists, canCreate, status_code = self._canCreateS3( bucketName )

        if( exists and status_code != '403' ):
            logging.info( bucketName + " already exists, no action taken." )
        elif( status_code == '403' ) :
            logging.info( bucketName + " already exists, access is forbidden.  Please choose another name. ")        
        elif( canCreate ) :
            logging.info( bucketName + " does not exist, creating.." )
            # aws s3 mb s3://aname.samm.deploy --region us-east-1
            # Strange, old bug in boto3 s3 api...
            if( self.region == 'us-east-1' ) :
                self.s3Resource.create_bucket(Bucket=bucketName )
            else :
                self.s3Resource.create_bucket(Bucket=bucketName, CreateBucketConfiguration={'LocationConstraint':self.region })
    

    def createS3Bucket( self, stackName, template, bucketName, deployBucket ) :
        logging.info( "Creating S3 static web bucket " + bucketName)

        # Check deploy bucket
        exists, canCreate, status_code = self._canCreateS3( deployBucket )
        if( not exists or status_code == '403' ) :
            logging.info(  "Please create the SAM deployment bucket first." )
            return

        # Run template if static web bucket can be created
        exists, canCreate, status_code = self._canCreateS3( bucketName )
        if( exists and status_code != '403' ):
            logging.info( bucketName + " already exists, no action taken." )
        elif( status_code == '403' ) :
            logging.info( bucketName + " already exists, access is forbidden.  Please choose another name. ")        
        elif( canCreate ) :
            self._runSAMTemplate( template = template, deployBucket = deployBucket, stackName = stackName )
            

    def createServerlessInfrastructure( self, stackName, template, webBucket, deployBucket ) :
        logging.info( "Creating Serverless Infrastructure specified in " + stackName )
        
        # Check deploy bucket
        exists, canCreate, status_code = self._canCreateS3( deployBucket )
        if( not exists or status_code == '403' ) :
            logging.info(  "Please create the SAM deployment bucket first." )
            return

        # Run template
        self._runSAMTemplate( template = template, deployBucket = deployBucket, stackName = stackName )


    def removeStackResources( self, stackName ) :
        if( not self._stackExists( stackName ) ) :
            logging.warning( stackName + " does not exist.  No need to delete it." )
            return

        # delete all s3 bucket contents first, to allow removal of bucket
        stackResourceSummaries = self.cfClient.list_stack_resources( StackName = stackName )
        for resource in stackResourceSummaries['StackResourceSummaries'] :
            logging.info( resource['LogicalResourceId'] + " " + resource['PhysicalResourceId'] + " " + resource['ResourceType'] )
            if( resource['ResourceType'] == "AWS::S3::Bucket" ) :
                # cmd = "aws s3 rb s3://codeequity.codeequity.net --force"
                bucket = self.s3Resource.Bucket( resource['PhysicalResourceId'] )
                bucket.objects.delete()
                
                # XXX throw 
                for obj in bucket.objects.all() :
                    logging.error( "Bucket delete did not complete" )
                    assert( False )

        # aws cloudformation delete-stack --stack-name S3StaticWeb
        self.cfClient.delete_stack( StackName = stackName )

        seconds = 0
        while( self._stackExists( stackName, silent = True ) ) :
            try: 
                status = self.cfClient.describe_stacks( StackName = stackName )['Stacks'][0]['StackStatus']
                if( status == "DELETE_IN_PROGRESS" and seconds % 5 == 0 ) :
                    logging.info( stackName + " " + status + " time elapsed: " + str(seconds)  )
            except ClientError as e:
                # If AWS completes between stackExists and describeStacks, this exception can be thrown
                logging.info( stackName + " deleted. " )

            if( not status == "DELETE_IN_PROGRESS" or seconds >= 120 ) :
                logging.error( stackName + " stack was not deleted. Perhaps it is in use by other cloudFormation stacks? " )
                logging.error( "Time spent: " + str(seconds) + " status: " + status )
                break
            time.sleep(1)
            seconds += 1
        

    def describeStack( self, stackName ) :
        try:
            outputs = self.cfClient.describe_stacks( StackName = stackName )['Stacks'][0]['Outputs']
            logging.info( "Outputs for " + stackName )
            for output in outputs:
                logging.info( output['OutputKey'] + "=" + output['OutputValue'] + ", " + output['Description'] )
                if( 'ExportName' in output.keys() ) : logging.info( " *** Exported as " + output['ExportName'] )
        except ClientError as e:
            logging.error( e )

    def getStackOutput( self, stackName, outputName ) :
        try:
            outputs = self.cfClient.describe_stacks( StackName = stackName )['Stacks'][0]['Outputs']
            res = ""
            for output in outputs:
                if( outputName == output['OutputKey'] ) :
                    res = output['OutputValue']
                    break
            return res
        except ClientError as e:
            logging.error( e )

