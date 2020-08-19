import os

def init():
    global ceRegion
    global ceAuthPath
    global ceSharedPem
    global ceProvPath
    global ceAppPath
    global ceNodeJSVersion
    global ceAppConfigPath  # android assets for cognito plugin
    global ceAppConfigName
    global ceAppAssetPath   # more typical pubspec.yaml assets
    global access_key_id
    global secret_access_key
    
    global samDeployBucket
    global samStaticWebBucket
    global samStaticWebYAML
    global samInfrastructureYAML
    global samStaticWebStackName
    global samCodeEquityAppStackName
    
    try:
        import configparser
        
        configFile = os.path.join(os.environ["HOME"], ".aws", "config") 
        print( "Reading AWS Config:", configFile )
        config = configparser.ConfigParser()
        config.read(configFile)
        access_key_id = config.get('default', 'aws_access_key_id', fallback='NOTHERE')
        secret_access_key = config.get('default', 'aws_secret_access_key', fallback='NOTHERE')
        ceRegion = config.get('default', 'region')

        # credential file may instead hold magic juice
        if( access_key_id == "NOTHERE" ):
            configFile = os.path.join(os.environ["HOME"], ".aws", "credentials") 
            print( "Reading AWS Credentials:", configFile )
            config = configparser.ConfigParser()
            config.read(configFile)
            access_key_id = config.get('default', 'aws_access_key_id')
            secret_access_key = config.get('default', 'aws_secret_access_key')

        print( ceRegion, access_key_id )
    except:
        print( configFile, "missing or invalid" )
        print( "Try running:  python createCE.py 'InstallAWSPermissions()' " )
        #raise

    ceAuthPath      = os.environ['CEPATH']+"/ops/aws/auth/"
    ceSharedPem     = ceAuthPath+"awsKey.pem"
    ceProvPath      = os.environ['CEPATH']+"/ops/aws/utils/"
    ceAppPath       = os.environ['CEPATH']+"/ceFlutter/"
    ceNodeJSVersion = "8.0.0"
    ceAppConfigPath = ceAppPath + "android/app/src/main/res/raw/"
    ceAppConfigName = "awsconfiguration.json"
    ceAppAssetPath  = ceAppPath + "files/"
    ceServerConfig  = ceAuthPath+"ceServerConfig.json"
    
    samDeployBucket        = "codeequity.sam.deploy"
    samStaticWebBucket     = "codeequity.codeequity.net"   # note this has to be consistent with yaml
    samStaticWebYAML       = os.environ['CEPATH']+"/ops/aws/samStaticWeb.yaml"
    samInfrastructureYAML  = os.environ['CEPATH']+"/ops/aws/samInfrastructure.yaml"

    samStaticWebStackName       = "codeEquityS3"
    samCodeEquityAppStackName    = "codeEquityApp"
