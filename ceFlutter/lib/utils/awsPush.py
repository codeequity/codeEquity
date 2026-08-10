#!/usr/bin/env python

# update equity agreement on aws
# cd <path_to_agreements>/.
# python ../codeEquity/ceFlutter/lib/utils/awsPush.py equityAgreement.html

import sys
import os
import base64
import boto3

def getUTF8(file_path):
    try: 
        with open(file_path, 'r', encoding='utf-8') as f:
            document = f.read()
    except Exception as e:
        print(f"An error occurred: {e}")
    
    return document


def main( fname ):

    # XXX pull region from config
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.Table('CEAgreements')

    # dead end
    # encoded_file_data = docx_to_b64(fname)
    
    file_data = getUTF8(fname)
    
    # Put item into the DynamoDB table
    try:
        response = table.put_item(
            Item={
                'AgreementId': 'ghdis94721',
                'AgmtType': 'equity',
                'Format': 'html',
                'Title': 'Equity Agreement',
                'Last Updated': 'yesterday',
                'Version': '0.9',
                'Document': file_data
            }
        )
        print("Item added to DynamoDB table:", response)
    except Exception as e:
        print(f"Error adding item: {e}")
    
if __name__ == "__main__":
    if len(sys.argv) < 2:
        main("")
    else:
        main(sys.argv[1])

    
